-- =============================================================================
-- Facturier — Hub Web Super Admin : Sécurité, Hook JWT, MFA (AAL2) & Audit
-- Migration 100% IDEMPOTENTE à exécuter dans Supabase > SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Custom Access Token Hook pour injection du rôle dans le JWT
-- -----------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb;
  user_role text;
begin
  claims := event->'claims';

  -- Récupération du rôle officiel depuis public.profiles
  select lower(role) into user_role
    from public.profiles
    where id = (event->>'user_id')::uuid;

  if user_role is not null then
    claims := jsonb_set(
      claims, '{user_role}', to_jsonb(user_role)
    );
  else
    claims := jsonb_set(
      claims, '{user_role}', to_jsonb('user'::text)
    );
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;

-- Permissions requises pour le service Supabase Auth (GoTrue)
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- -----------------------------------------------------------------------------
-- 2. Fonction utilitaire de vérification Super Admin avec second facteur (AAL2)
-- -----------------------------------------------------------------------------
create or replace function public.is_superadmin_aal2()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_superadmin() and coalesce((auth.jwt()->>'aal'), 'aal1') = 'aal2'
$$;

-- -----------------------------------------------------------------------------
-- 3. Table d'audit immuable (Append-Only) du Hub Web
-- -----------------------------------------------------------------------------
create table if not exists public.hub_audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid not null references auth.users(id),
  actor_email text not null,
  action text not null,
  target_type text not null,
  target_id text,
  tenant_id uuid references public.tenants(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text
);

-- Index d'investigation
create index if not exists idx_hub_audit_logs_actor on public.hub_audit_logs(actor_id);
create index if not exists idx_hub_audit_logs_tenant on public.hub_audit_logs(tenant_id);
create index if not exists idx_hub_audit_logs_created_at on public.hub_audit_logs(created_at desc);
create index if not exists idx_hub_audit_logs_action on public.hub_audit_logs(action);

-- Activation de RLS
alter table public.hub_audit_logs enable row level security;

-- Réinitialisation propre des policies
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'hub_audit_logs' loop
    execute format('drop policy if exists %I on public.hub_audit_logs', p.policyname);
  end loop;
end $$;

-- Consultation réservée aux superadmins authentifiés
create policy hub_audit_logs_select on public.hub_audit_logs for select to authenticated
  using (public.is_superadmin());

-- Insertion autorisée pour le superadmin lui-même
create policy hub_audit_logs_insert on public.hub_audit_logs for insert to authenticated
  with check (public.is_superadmin() and actor_id = auth.uid());

-- Aucune politique UPDATE ni DELETE n'existe => Immutabilité garantie en base

-- -----------------------------------------------------------------------------
-- 4. Procédure stockée d'audit sécurisée (RPC)
-- -----------------------------------------------------------------------------
create or replace function public.log_hub_action(
  p_action text,
  p_target_type text,
  p_target_id text default null,
  p_tenant_id uuid default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_ip text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
  v_email text;
begin
  if not public.is_superadmin() then
    raise exception 'Accès refusé : privilèges superadmin requis';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into public.hub_audit_logs (
    actor_id,
    actor_email,
    action,
    target_type,
    target_id,
    tenant_id,
    reason,
    metadata,
    ip_address,
    user_agent
  ) values (
    auth.uid(),
    coalesce(v_email, 'superadmin@hub'),
    p_action,
    p_target_type,
    p_target_id,
    p_tenant_id,
    p_reason,
    coalesce(p_metadata, '{}'::jsonb),
    p_ip,
    p_user_agent
  ) returning id into v_log_id;

  return v_log_id;
end;
$$;
