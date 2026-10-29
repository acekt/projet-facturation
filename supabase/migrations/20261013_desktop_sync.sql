-- =============================================================================
-- Facturier — Migration Complète de Synchronisation Desktop (SQLite) <-> Supabase
-- À exécuter dans Supabase > SQL Editor.
-- Ce script est 100% IDEMPOTENT et AUTO-SUFFISANT :
--   - Fonctionne sur une base NEUVE (après suppression/reset des tables)
--   - Fonctionne sur une base EXISTANTE (renomme les anciennes tables incompatibles en *_legacy)
--   - Peut être exécuté plusieurs fois sans aucune erreur
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables fondamentales Multi-Tenant & Profils (création si base neuve)
-- ---------------------------------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  email text,
  role text not null default 'user',
  full_name text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Garantir la présence des colonnes même si profiles existait déjà avec un ancien schéma
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists is_active boolean not null default true;

-- Assouplissement de la contrainte de rôle pour accepter 'user' et 'operateur'
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (lower(role) in ('superadmin', 'super_admin', 'admin', 'user', 'operateur', 'operator'));

-- ---------------------------------------------------------------------------
-- 2. Fonctions utilitaires de sécurité (SECURITY DEFINER => zéro récursion RLS)
-- ---------------------------------------------------------------------------
create or replace function public.current_tenant_id()
returns text language sql stable security definer set search_path = public as $$
  select tenant_id::text from public.profiles where id = auth.uid()
$$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select lower(role) in ('superadmin', 'super_admin') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.touch_server_updated_at()
returns trigger language plpgsql as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Sécurité RLS sur profiles et tenants
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy if exists %I on public.profiles', p.policyname);
  end loop;
end $$;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or tenant_id::text = public.current_tenant_id() or public.is_superadmin());

create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_superadmin_all on public.profiles for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

alter table public.tenants enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'tenants' loop
    execute format('drop policy if exists %I on public.tenants', p.policyname);
  end loop;
end $$;

create policy tenants_select on public.tenants for select to authenticated
  using (id::text = public.current_tenant_id() or public.is_superadmin());

create policy tenants_superadmin_all on public.tenants for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- ---------------------------------------------------------------------------
-- 4. Fonctions RPC : Provisioning Tenant et Rattachement des Membres
-- ---------------------------------------------------------------------------

-- 4.1 Provisioning lors du setup initial (crée tenant + associe profil admin)
create or replace function public.provision_tenant(
  p_company_name text,
  p_full_name text default null,
  p_phone text default null
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_tenant public.tenants.id%type;
  v_existing text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select tenant_id::text into v_existing from public.profiles where id = v_uid;
  if v_existing is not null then return v_existing; end if;

  select email into v_email from auth.users where id = v_uid;

  insert into public.tenants (name) values (coalesce(nullif(trim(p_company_name), ''), 'Mon entreprise'))
    returning id into v_tenant;

  insert into public.profiles (id, tenant_id, email, role, full_name, phone)
    values (v_uid, v_tenant, v_email, 'admin', p_full_name, p_phone)
  on conflict (id) do update
    set tenant_id = excluded.tenant_id, role = 'admin',
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        phone = coalesce(excluded.phone, public.profiles.phone);

  return v_tenant::text;
end;
$$;
revoke all on function public.provision_tenant(text, text, text) from public;
grant execute on function public.provision_tenant(text, text, text) to authenticated;

-- 4.2 Rattachement d'un membre (opérateur ou admin) créé depuis le Desktop
create or replace function public.attach_member(
  p_user_id uuid,
  p_role text default 'user',
  p_full_name text default null,
  p_phone text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller_role text;
  v_tenant public.profiles.tenant_id%type;
  v_target_tenant text;
  v_email text;
  v_role text := case when lower(coalesce(p_role, '')) = 'admin' then 'admin' else 'user' end;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select lower(role), tenant_id into v_caller_role, v_tenant from public.profiles where id = auth.uid();
  if v_caller_role is distinct from 'admin' or v_tenant is null then
    raise exception 'forbidden: admin only';
  end if;

  select tenant_id::text into v_target_tenant from public.profiles where id = p_user_id;
  if v_target_tenant is not null and v_target_tenant <> v_tenant::text then
    raise exception 'user belongs to another tenant';
  end if;

  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then raise exception 'unknown user'; end if;

  insert into public.profiles (id, tenant_id, email, role, full_name, phone)
    values (p_user_id, v_tenant, v_email, v_role, p_full_name, p_phone)
  on conflict (id) do update
    set tenant_id = excluded.tenant_id,
        role = excluded.role,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        phone = coalesce(excluded.phone, public.profiles.phone);
end $$;
revoke all on function public.attach_member(uuid, text, text, text) from public;
grant execute on function public.attach_member(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Ancien bloc de renommage *_legacy (désactivé par le plan curatif H3 / ADR-0039)
--    Les tables métier sont créées directement en section 6.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 6. Tables métier (miroir snake_case du schéma SQLite local)
--    id texte (UUID v4 généré côté Desktop), soft delete, tenant_id obligatoire
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id text primary key, tenant_id text not null,
  name text, email text, phone text, address text, status text,
  created_at text, deleted_at text, created_by text,
  updated_at timestamptz, server_updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id text primary key, tenant_id text not null,
  name text, description text, category text, unit_price double precision,
  created_at text, deleted_at text, created_by text,
  updated_at timestamptz, server_updated_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id text primary key, tenant_id text not null,
  number text, client_id text, client_name text, client_email text, date text,
  subtotal double precision, discount double precision, tax_base double precision,
  tps_amount double precision, tva_amount double precision, css_amount double precision,
  total double precision, status text, notes text, subject text, valid_until text,
  created_at text, deleted_at text, created_by text,
  updated_at timestamptz, server_updated_at timestamptz not null default now()
);

create table if not exists public.quote_items (
  id text primary key, tenant_id text not null,
  quote_id text, description text, quantity double precision, unit_price double precision, total double precision,
  updated_at timestamptz, server_updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id text primary key, tenant_id text not null,
  number text, quote_id text, client_id text, client_name text, client_email text, date text,
  subtotal double precision, discount double precision, tax_base double precision,
  tps_amount double precision, tva_amount double precision, css_amount double precision,
  total double precision, status text, notes text, subject text, due_date text,
  created_at text, deleted_at text, created_by text,
  updated_at timestamptz, server_updated_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id text primary key, tenant_id text not null,
  invoice_id text, description text, quantity double precision, unit_price double precision, total double precision,
  updated_at timestamptz, server_updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id text primary key, tenant_id text not null,
  invoice_id text, amount double precision, payment_method text, date text, reference text,
  created_at text, deleted_at text, created_by text,
  updated_at timestamptz, server_updated_at timestamptz not null default now()
);

create table if not exists public.credit_notes (
  id text primary key, tenant_id text not null,
  number text, invoice_id text, client_id text, client_name text, date text, reason text,
  subtotal double precision, tax_base double precision,
  tps_amount double precision, tva_amount double precision, css_amount double precision,
  total double precision, status text,
  created_at text, created_by text, deleted_at text,
  updated_at timestamptz, server_updated_at timestamptz not null default now()
);

create table if not exists public.credit_note_items (
  id text primary key, tenant_id text not null,
  credit_note_id text, description text, quantity double precision, unit_price double precision, total double precision,
  updated_at timestamptz, server_updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key, tenant_id text not null,
  user_id text, user_name text, action text, entity_type text, entity_id text, details text,
  created_at text,
  updated_at timestamptz, server_updated_at timestamptz not null default now()
);

-- Paramètres société : une ligne par tenant
create table if not exists public.tenant_settings (
  tenant_id text primary key,
  company_name text, legal_form text, nif text, rccm text, address text, email text, phone text,
  bank_name text, bank_agency text, account_number text, swift_code text, iban text,
  tva_rate double precision, tps_rate double precision, css_rate double precision,
  session_timeout integer, invoice_prefix text, quote_prefix text, company_code text,
  mentions_legales text, logo text,
  updated_at timestamptz, server_updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. Index de synchronisation, trigger horodatage serveur et RLS multi-tenant
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array['clients','services','quotes','quote_items','invoices','invoice_items',
                         'payments','credit_notes','credit_note_items','audit_logs','tenant_settings'];
begin
  foreach t in array tables loop
    execute format('create index if not exists %I on public.%I (tenant_id, server_updated_at)', 'idx_' || t || '_sync', t);

    execute format('drop trigger if exists trg_%I_server_ts on public.%I', t, t);
    execute format('create trigger trg_%I_server_ts before insert or update on public.%I
                    for each row execute function public.touch_server_updated_at()', t, t);

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation on public.%I', t);
    execute format('create policy tenant_isolation on public.%I for all to authenticated
                    using (tenant_id = public.current_tenant_id() or public.is_superadmin())
                    with check (tenant_id = public.current_tenant_id() or public.is_superadmin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Numérotation unique par tenant (garantit la cohérence entre postes)
-- ---------------------------------------------------------------------------
create unique index if not exists uq_quotes_tenant_number on public.quotes (tenant_id, number) where number is not null;
create unique index if not exists uq_invoices_tenant_number on public.invoices (tenant_id, number) where number is not null;
create unique index if not exists uq_credit_notes_tenant_number on public.credit_notes (tenant_id, number) where number is not null;
