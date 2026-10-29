-- ============================================================================
-- MIGRATION : Durcissement du Schéma Cloud et RLS Performante (Lot I / ADR-0040)
-- Conforme aux recommandations Context7 / Supabase Advisor (P11, P12, P13, D11)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Contrôles préalables et assainissement des données
-- ----------------------------------------------------------------------------
do $$
begin
  -- Vérification d'orphelins éventuels
  delete from public.invoice_items
  where invoice_id not in (select id from public.invoices);

  delete from public.quote_items
  where quote_id not in (select id from public.quotes);

  delete from public.credit_note_items
  where credit_note_id not in (select id from public.credit_notes);

  delete from public.payments
  where invoice_id not in (select id from public.invoices);
end $$;

-- ----------------------------------------------------------------------------
-- 2. Montants en entiers (BIGINT) et contraintes de non-négativité (I2/I3)
-- ----------------------------------------------------------------------------
-- Factures
alter table public.invoices
  alter column subtotal type bigint using round(coalesce(subtotal, 0))::bigint,
  alter column discount type bigint using round(coalesce(discount, 0))::bigint,
  alter column tax_base type bigint using round(coalesce(tax_base, 0))::bigint,
  alter column tps_amount type bigint using round(coalesce(tps_amount, 0))::bigint,
  alter column tva_amount type bigint using round(coalesce(tva_amount, 0))::bigint,
  alter column css_amount type bigint using round(coalesce(css_amount, 0))::bigint,
  alter column total type bigint using round(coalesce(total, 0))::bigint;

alter table public.invoices
  drop constraint if exists invoices_amounts_non_negative,
  add constraint invoices_amounts_non_negative
  check (
    subtotal >= 0 and discount >= 0 and tax_base >= 0 and
    tps_amount >= 0 and tva_amount >= 0 and css_amount >= 0 and total >= 0
  );

-- Devis
alter table public.quotes
  alter column subtotal type bigint using round(coalesce(subtotal, 0))::bigint,
  alter column discount type bigint using round(coalesce(discount, 0))::bigint,
  alter column tax_base type bigint using round(coalesce(tax_base, 0))::bigint,
  alter column tps_amount type bigint using round(coalesce(tps_amount, 0))::bigint,
  alter column tva_amount type bigint using round(coalesce(tva_amount, 0))::bigint,
  alter column css_amount type bigint using round(coalesce(css_amount, 0))::bigint,
  alter column total type bigint using round(coalesce(total, 0))::bigint;

alter table public.quotes
  drop constraint if exists quotes_amounts_non_negative,
  add constraint quotes_amounts_non_negative
  check (
    subtotal >= 0 and discount >= 0 and tax_base >= 0 and
    tps_amount >= 0 and tva_amount >= 0 and css_amount >= 0 and total >= 0
  );

-- Avoirs
alter table public.credit_notes
  alter column subtotal type bigint using round(coalesce(subtotal, 0))::bigint,
  alter column tax_base type bigint using round(coalesce(tax_base, 0))::bigint,
  alter column tps_amount type bigint using round(coalesce(tps_amount, 0))::bigint,
  alter column tva_amount type bigint using round(coalesce(tva_amount, 0))::bigint,
  alter column css_amount type bigint using round(coalesce(css_amount, 0))::bigint,
  alter column total type bigint using round(coalesce(total, 0))::bigint;

alter table public.credit_notes
  drop constraint if exists credit_notes_amounts_non_negative,
  add constraint credit_notes_amounts_non_negative
  check (
    subtotal >= 0 and tax_base >= 0 and
    tps_amount >= 0 and tva_amount >= 0 and css_amount >= 0 and total >= 0
  );

-- Lignes d'articles et paiements
alter table public.invoice_items
  alter column unit_price type bigint using round(coalesce(unit_price, 0))::bigint,
  alter column total type bigint using round(coalesce(total, 0))::bigint;

alter table public.invoice_items
  drop constraint if exists invoice_items_amounts_non_negative,
  add constraint invoice_items_amounts_non_negative
  check (unit_price >= 0 and total >= 0 and quantity > 0);

alter table public.quote_items
  alter column unit_price type bigint using round(coalesce(unit_price, 0))::bigint,
  alter column total type bigint using round(coalesce(total, 0))::bigint;

alter table public.quote_items
  drop constraint if exists quote_items_amounts_non_negative,
  add constraint quote_items_amounts_non_negative
  check (unit_price >= 0 and total >= 0 and quantity > 0);

alter table public.credit_note_items
  alter column unit_price type bigint using round(coalesce(unit_price, 0))::bigint,
  alter column total type bigint using round(coalesce(total, 0))::bigint;

alter table public.credit_note_items
  drop constraint if exists credit_note_items_amounts_non_negative,
  add constraint credit_note_items_amounts_non_negative
  check (unit_price >= 0 and total >= 0 and quantity > 0);

alter table public.payments
  alter column amount type bigint using round(coalesce(amount, 0))::bigint;

alter table public.payments
  drop constraint if exists payments_amount_non_negative,
  add constraint payments_amount_non_negative
  check (amount >= 0);

alter table public.services
  alter column unit_price type bigint using round(coalesce(unit_price, 0))::bigint;

alter table public.services
  drop constraint if exists services_price_non_negative,
  add constraint services_price_non_negative
  check (unit_price >= 0);

-- ----------------------------------------------------------------------------
-- 3. Contraintes de Statut (CHECK)
-- ----------------------------------------------------------------------------
alter table public.invoices
  drop constraint if exists check_invoices_status,
  add constraint check_invoices_status
  check (status in ('UNPAID', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'OVERDUE'));

alter table public.quotes
  drop constraint if exists check_quotes_status,
  add constraint check_quotes_status
  check (status in ('EN_ATTENTE', 'VALIDE', 'REFUSE', 'BROUILLON', 'ENVOYE', 'CONVERTI', 'EXPIRE', 'EXPIRED'));

alter table public.credit_notes
  drop constraint if exists check_credit_notes_status,
  add constraint check_credit_notes_status
  check (status in ('open', 'applied', 'cancelled'));

alter table public.clients
  drop constraint if exists check_clients_status,
  add constraint check_clients_status
  check (status in ('active', 'inactive'));

-- ----------------------------------------------------------------------------
-- 4. Intégrité Référentielle (Clés étrangères avec NOT VALID puis VALIDATE)
-- ----------------------------------------------------------------------------
-- Clés étrangères enfants avec ON DELETE CASCADE
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_invoice_items_invoice') then
    alter table public.invoice_items
      add constraint fk_invoice_items_invoice
      foreign key (invoice_id) references public.invoices(id) on delete cascade not valid;
    alter table public.invoice_items validate constraint fk_invoice_items_invoice;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_quote_items_quote') then
    alter table public.quote_items
      add constraint fk_quote_items_quote
      foreign key (quote_id) references public.quotes(id) on delete cascade not valid;
    alter table public.quote_items validate constraint fk_quote_items_quote;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_credit_note_items_cn') then
    alter table public.credit_note_items
      add constraint fk_credit_note_items_cn
      foreign key (credit_note_id) references public.credit_notes(id) on delete cascade not valid;
    alter table public.credit_note_items validate constraint fk_credit_note_items_cn;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_payments_invoice') then
    alter table public.payments
      add constraint fk_payments_invoice
      foreign key (invoice_id) references public.invoices(id) on delete cascade not valid;
    alter table public.payments validate constraint fk_payments_invoice;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_credit_notes_invoice') then
    alter table public.credit_notes
      add constraint fk_credit_notes_invoice
      foreign key (invoice_id) references public.invoices(id) not valid;
    alter table public.credit_notes validate constraint fk_credit_notes_invoice;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 5. RLS Performante : Schéma Privé et Fonctions Sécurisées (I4 / P13)
-- Conforme aux recommandations Context7 / Supabase Advisor (auth_rls_initplan 0003)
-- ----------------------------------------------------------------------------
create schema if not exists private;

create or replace function private.current_tenant_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select tenant_id::text from public.profiles where id = (select auth.uid());
$$;

create or replace function private.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.superadmin_whitelist
    where user_id = (select auth.uid()) and is_active = true
  );
$$;

revoke execute on function private.current_tenant_id() from public;
revoke execute on function private.is_superadmin() from public;
grant usage on schema private to authenticated;
grant execute on function private.current_tenant_id() to authenticated;
grant execute on function private.is_superadmin() to authenticated;

-- Index indispensables sur les clés étrangères pour éviter les scans séquentiels RLS
create index if not exists idx_invoice_items_invoice on public.invoice_items (invoice_id);
create index if not exists idx_quote_items_quote on public.quote_items (quote_id);
create index if not exists idx_credit_note_items_cn on public.credit_note_items (credit_note_id);
create index if not exists idx_payments_invoice on public.payments (invoice_id);
create index if not exists idx_credit_notes_invoice on public.credit_notes (invoice_id);

-- Mise à jour des politiques RLS avec select wrapper (Postgres initPlan caching)
drop policy if exists tenant_isolation_invoices on public.invoices;
create policy tenant_isolation_invoices on public.invoices
  for all to authenticated
  using (tenant_id = (select private.current_tenant_id()) or (select private.is_superadmin()))
  with check (tenant_id = (select private.current_tenant_id()) or (select private.is_superadmin()));

drop policy if exists tenant_isolation_quotes on public.quotes;
create policy tenant_isolation_quotes on public.quotes
  for all to authenticated
  using (tenant_id = (select private.current_tenant_id()) or (select private.is_superadmin()))
  with check (tenant_id = (select private.current_tenant_id()) or (select private.is_superadmin()));

drop policy if exists tenant_isolation_clients on public.clients;
create policy tenant_isolation_clients on public.clients
  for all to authenticated
  using (tenant_id = (select private.current_tenant_id()) or (select private.is_superadmin()))
  with check (tenant_id = (select private.current_tenant_id()) or (select private.is_superadmin()));

drop policy if exists tenant_isolation_services on public.services;
create policy tenant_isolation_services on public.services
  for all to authenticated
  using (tenant_id = (select private.current_tenant_id()) or (select private.is_superadmin()))
  with check (tenant_id = (select private.current_tenant_id()) or (select private.is_superadmin()));

drop policy if exists tenant_isolation_payments on public.payments;
create policy tenant_isolation_payments on public.payments
  for all to authenticated
  using (tenant_id = (select private.current_tenant_id()) or (select private.is_superadmin()))
  with check (tenant_id = (select private.current_tenant_id()) or (select private.is_superadmin()));

drop policy if exists tenant_isolation_credit_notes on public.credit_notes;
create policy tenant_isolation_credit_notes on public.credit_notes
  for all to authenticated
  using (tenant_id = (select private.current_tenant_id()) or (select private.is_superadmin()))
  with check (tenant_id = (select private.current_tenant_id()) or (select private.is_superadmin()));

-- ----------------------------------------------------------------------------
-- 6. Logo hors de la base (I5 / P12)
-- ----------------------------------------------------------------------------
-- Colonnes de chemin et d'empreinte SHA256 sur tenant_settings
alter table public.tenant_settings
  add column if not exists logo_path text,
  add column if not exists logo_sha256 text;

-- Bucket de stockage dédié 'tenant-logos'
insert into storage.buckets (id, name, public)
values ('tenant-logos', 'tenant-logos', false)
on conflict (id) do nothing;

-- Politiques de stockage
drop policy if exists "Tenant members can view logos" on storage.objects;
create policy "Tenant members can view logos" on storage.objects
  for select to authenticated
  using (bucket_id = 'tenant-logos');

drop policy if exists "Tenant admins can upload logos" on storage.objects;
create policy "Tenant admins can upload logos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'tenant-logos' and
    ((select private.current_tenant_id()) is not null or (select private.is_superadmin()))
  );
