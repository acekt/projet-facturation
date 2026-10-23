-- =============================================================================
-- Facturier — Hub Web Super Admin : Modèles SaaS, Flotte & KPIs Quotidiens
-- Migration 100% IDEMPOTENTE à exécuter dans Supabase > SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table des Plans d'abonnement (public.plans)
-- -----------------------------------------------------------------------------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  price_xaf numeric not null default 0,
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'annual', 'lifetime')),
  max_users int not null default 5,
  max_devices int not null default 3,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Données initiales des plans
insert into public.plans (code, name, description, price_xaf, billing_period, max_users, max_devices, features)
values
  ('free_trial', 'Essai Gratuit', 'Période d''évaluation complète 14 jours', 0, 'monthly', 2, 2, '{"sync": true, "multi_device": true, "export_csv": true}'::jsonb),
  ('starter', 'Plan Starter', 'Pour artisans et indépendants', 15000, 'monthly', 3, 2, '{"sync": true, "multi_device": true, "export_csv": true, "support": "email"}'::jsonb),
  ('pro', 'Plan Pro PME', 'Pour PME avec équipe de facturation', 35000, 'monthly', 10, 5, '{"sync": true, "multi_device": true, "export_csv": true, "support": "priority", "analytics": true}'::jsonb),
  ('enterprise', 'Plan Entreprise', 'Multi-postes étendu et support dédié', 75000, 'monthly', 50, 20, '{"sync": true, "multi_device": true, "export_csv": true, "support": "dedicated", "analytics": true, "custom_sla": true}'::jsonb)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  price_xaf = excluded.price_xaf,
  max_users = excluded.max_users,
  max_devices = excluded.max_devices,
  features = excluded.features;

-- -----------------------------------------------------------------------------
-- 2. Enrichissement de la table public.tenants
-- -----------------------------------------------------------------------------
alter table public.tenants add column if not exists status text not null default 'active';
alter table public.tenants drop constraint if exists tenants_status_check;
alter table public.tenants add constraint tenants_status_check
  check (status in ('active', 'trial', 'suspended', 'expired'));

alter table public.tenants add column if not exists plan_id uuid references public.plans(id) on delete set null;
alter table public.tenants add column if not exists trial_ends_at timestamptz;
alter table public.tenants add column if not exists license_expires_at timestamptz;
alter table public.tenants add column if not exists country text default 'Cameroun';
alter table public.tenants add column if not exists suspended_reason text;
alter table public.tenants add column if not exists suspended_at timestamptz;
alter table public.tenants add column if not exists notes text;

-- Associer le plan 'starter' par défaut aux tenants existants sans plan
update public.tenants
set plan_id = (select id from public.plans where code = 'starter' limit 1)
where plan_id is null;

-- -----------------------------------------------------------------------------
-- 3. Flotte des Postes Desktop (public.sync_devices)
-- -----------------------------------------------------------------------------
create table if not exists public.sync_devices (
  device_id text not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  device_name text,
  os text,
  app_version text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_status text not null default 'success' check (last_status in ('success', 'error', 'pending')),
  metadata jsonb not null default '{}'::jsonb,
  primary key (device_id, tenant_id)
);

create index if not exists idx_sync_devices_tenant on public.sync_devices(tenant_id);
create index if not exists idx_sync_devices_last_seen on public.sync_devices(last_seen_at desc);

-- -----------------------------------------------------------------------------
-- 4. Journal d'Exécution des Synchronisations (public.sync_runs - Purge 90j)
-- -----------------------------------------------------------------------------
create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  device_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz default now(),
  duration_ms int not null default 0,
  pushed int not null default 0,
  pulled int not null default 0,
  deleted int not null default 0,
  skipped int not null default 0,
  error_count int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  app_version text,
  os text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sync_runs_tenant on public.sync_runs(tenant_id);
create index if not exists idx_sync_runs_created_at on public.sync_runs(created_at desc);
create index if not exists idx_sync_runs_device on public.sync_runs(device_id);

-- -----------------------------------------------------------------------------
-- 5. Agrégations Journalières des KPIs (public.kpi_tenant_daily)
-- -----------------------------------------------------------------------------
create table if not exists public.kpi_tenant_daily (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  metric_date date not null,
  documents_created int not null default 0,
  invoices_count int not null default 0,
  quotes_count int not null default 0,
  total_revenue_xaf numeric not null default 0,
  total_paid_xaf numeric not null default 0,
  active_users_count int not null default 0,
  sync_count int not null default 0,
  sync_errors_count int not null default 0,
  avg_sync_duration_ms int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, metric_date)
);

create index if not exists idx_kpi_tenant_daily_date on public.kpi_tenant_daily(metric_date desc);
create index if not exists idx_kpi_tenant_daily_tenant on public.kpi_tenant_daily(tenant_id, metric_date desc);

-- -----------------------------------------------------------------------------
-- 6. Règles d'Alerte et Boîte de Réception (public.alert_rules & public.alerts)
-- -----------------------------------------------------------------------------
create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  metric_name text not null,
  threshold numeric not null,
  operator text not null default 'gt' check (operator in ('gt', 'lt', 'eq', 'gte', 'lte')),
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.alert_rules (name, code, metric_name, threshold, operator, severity)
values
  ('Erreurs de synchro répétées', 'sync_errors_high', 'sync_errors_count', 5, 'gte', 'critical'),
  ('Poste non synchronisé > 7j', 'device_stale_7d', 'days_since_last_sync', 7, 'gte', 'warning'),
  ('Licence proche expiration (15j)', 'license_expiring_soon', 'days_before_expiry', 15, 'lte', 'info')
on conflict (code) do nothing;

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  rule_id uuid references public.alert_rules(id) on delete set null,
  title text not null,
  message text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_alerts_status on public.alerts(status, created_at desc);

-- -----------------------------------------------------------------------------
-- 7. Annonces et Drapeaux de fonctionnalités
-- -----------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target_tenant_id uuid references public.tenants(id) on delete cascade,
  level text not null default 'info' check (level in ('info', 'warning', 'maintenance', 'critical')),
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_flags (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  flag_key text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, flag_key)
);

-- -----------------------------------------------------------------------------
-- 8. Sécurité Row Level Security (RLS)
-- -----------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.sync_devices enable row level security;
alter table public.sync_runs enable row level security;
alter table public.kpi_tenant_daily enable row level security;
alter table public.alert_rules enable row level security;
alter table public.alerts enable row level security;
alter table public.announcements enable row level security;
alter table public.tenant_flags enable row level security;

-- Nettoyage propre des policies
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname = 'public'
    and tablename in ('plans','sync_devices','sync_runs','kpi_tenant_daily','alert_rules','alerts','announcements','tenant_flags') loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- Plans : lecture pour tous les authentifiés, écriture Super Admin
create policy plans_select on public.plans for select to authenticated using (true);
create policy plans_superadmin on public.plans for all to authenticated using (public.is_superadmin());

-- Sync Devices : lecture/écriture pour le tenant propriétaire ou Super Admin
create policy sync_devices_tenant_all on public.sync_devices for all to authenticated
  using (tenant_id::text = public.current_tenant_id() or public.is_superadmin())
  with check (tenant_id::text = public.current_tenant_id() or public.is_superadmin());

-- Sync Runs : insertion pour le tenant, lecture pour tenant & Super Admin (append-only)
create policy sync_runs_insert on public.sync_runs for insert to authenticated
  with check (tenant_id::text = public.current_tenant_id() or public.is_superadmin());
create policy sync_runs_select on public.sync_runs for select to authenticated
  using (tenant_id::text = public.current_tenant_id() or public.is_superadmin());

-- KPIs quotidiens : réservé au Super Admin
create policy kpi_tenant_daily_superadmin on public.kpi_tenant_daily for all to authenticated
  using (public.is_superadmin());

-- Alertes & Règles : réservé au Super Admin
create policy alert_rules_superadmin on public.alert_rules for all to authenticated
  using (public.is_superadmin());
create policy alerts_superadmin on public.alerts for all to authenticated
  using (public.is_superadmin());

-- Annonces : visibles par le tenant ciblé (ou globales) et Super Admin
create policy announcements_select on public.announcements for select to authenticated
  using (is_active and (target_tenant_id is null or target_tenant_id::text = public.current_tenant_id() or public.is_superadmin()));
create policy announcements_superadmin on public.announcements for all to authenticated
  using (public.is_superadmin());

-- Feature Flags : visibles par le tenant concerné ou Super Admin
create policy tenant_flags_select on public.tenant_flags for select to authenticated
  using (tenant_id::text = public.current_tenant_id() or public.is_superadmin());
create policy tenant_flags_superadmin on public.tenant_flags for all to authenticated
  using (public.is_superadmin());

-- -----------------------------------------------------------------------------
-- 9. RPC : Enregistrement de télémétrie Desktop (hub_record_sync_telemetry)
-- -----------------------------------------------------------------------------
create or replace function public.hub_record_sync_telemetry(
  p_device_id text,
  p_os text default null,
  p_app_version text default null,
  p_device_name text default null,
  p_duration_ms int default 0,
  p_pushed int default 0,
  p_pulled int default 0,
  p_deleted int default 0,
  p_skipped int default 0,
  p_error_count int default 0,
  p_errors jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_run_id uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  select tenant_id into v_tenant_id from public.profiles where id = auth.uid();
  if v_tenant_id is null then
    raise exception 'Profil sans tenant';
  end if;

  v_status := case when p_error_count > 0 then 'error' else 'success' end;

  -- 1. Mise à jour ou insertion dans sync_devices
  insert into public.sync_devices (
    device_id, tenant_id, user_id, device_name, os, app_version,
    last_seen_at, last_sync_at, last_status
  ) values (
    p_device_id, v_tenant_id, auth.uid(), p_device_name, p_os, p_app_version,
    now(), now(), v_status
  )
  on conflict (device_id, tenant_id) do update set
    user_id = auth.uid(),
    device_name = coalesce(excluded.device_name, sync_devices.device_name),
    os = coalesce(excluded.os, sync_devices.os),
    app_version = coalesce(excluded.app_version, sync_devices.app_version),
    last_seen_at = now(),
    last_sync_at = now(),
    last_status = excluded.last_status;

  -- 2. Insertion dans l'historique sync_runs
  insert into public.sync_runs (
    tenant_id, device_id, user_id, duration_ms, pushed, pulled,
    deleted, skipped, error_count, errors, app_version, os
  ) values (
    v_tenant_id, p_device_id, auth.uid(), p_duration_ms, p_pushed, p_pulled,
    p_deleted, p_skipped, p_error_count, coalesce(p_errors, '[]'::jsonb),
    p_app_version, p_os
  ) returning id into v_run_id;

  return v_run_id;
end;
$$;

revoke all on function public.hub_record_sync_telemetry from public;
grant execute on function public.hub_record_sync_telemetry to authenticated;

-- -----------------------------------------------------------------------------
-- 10. Procédure de Purge des Vieux Runs (90 jours)
-- -----------------------------------------------------------------------------
create or replace function public.hub_purge_old_sync_runs(p_days int default 90)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.sync_runs
  where created_at < now() - (p_days || ' days')::interval;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Procédure d'Agrégation Journalière des KPIs (hub_collect_daily_kpis)
-- -----------------------------------------------------------------------------
create or replace function public.hub_collect_daily_kpis(p_date date default (now() - interval '1 day')::date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant record;
  v_invoices_count int;
  v_quotes_count int;
  v_revenue numeric;
  v_paid numeric;
  v_active_users int;
  v_sync_count int;
  v_sync_errors int;
  v_avg_duration int;
  v_count int := 0;
begin
  for v_tenant in select id from public.tenants loop
    -- Factures créées ce jour
    select count(*), coalesce(sum(total), 0)
    into v_invoices_count, v_revenue
    from public.invoices
    where tenant_id = v_tenant.id::text
      and deleted_at is null
      and date(created_at) = p_date;

    -- Règlements perçus ce jour
    select coalesce(sum(amount), 0)
    into v_paid
    from public.payments
    where tenant_id = v_tenant.id::text
      and deleted_at is null
      and date(created_at) = p_date;

    -- Devis créés ce jour
    select count(*)
    into v_quotes_count
    from public.quotes
    where tenant_id = v_tenant.id::text
      and deleted_at is null
      and date(created_at) = p_date;

    -- Utilisateurs actifs (ayant exécuté une synchro ce jour)
    select count(distinct user_id)
    into v_active_users
    from public.sync_runs
    where tenant_id = v_tenant.id
      and date(created_at) = p_date;

    -- Métriques de synchronisation
    select count(*), coalesce(sum(case when error_count > 0 then 1 else 0 end), 0), coalesce(avg(duration_ms)::int, 0)
    into v_sync_count, v_sync_errors, v_avg_duration
    from public.sync_runs
    where tenant_id = v_tenant.id
      and date(created_at) = p_date;

    -- Insertion ou mise à jour idempotente
    insert into public.kpi_tenant_daily (
      tenant_id, metric_date, documents_created, invoices_count, quotes_count,
      total_revenue_xaf, total_paid_xaf, active_users_count, sync_count,
      sync_errors_count, avg_sync_duration_ms, updated_at
    ) values (
      v_tenant.id, p_date, (v_invoices_count + v_quotes_count), v_invoices_count, v_quotes_count,
      v_revenue, v_paid, v_active_users, v_sync_count,
      v_sync_errors, v_avg_duration, now()
    )
    on conflict (tenant_id, metric_date) do update set
      documents_created = excluded.documents_created,
      invoices_count = excluded.invoices_count,
      quotes_count = excluded.quotes_count,
      total_revenue_xaf = excluded.total_revenue_xaf,
      total_paid_xaf = excluded.total_paid_xaf,
      active_users_count = excluded.active_users_count,
      sync_count = excluded.sync_count,
      sync_errors_count = excluded.sync_errors_count,
      avg_sync_duration_ms = excluded.avg_sync_duration_ms,
      updated_at = now();

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. Tâches planifiées (pg_cron si l'extension est active)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Purge hebdomadaire dimanche à 03:00 UTC
    begin
      perform cron.unschedule('hub-purge-sync-runs');
    exception when others then null;
    end;
    perform cron.schedule('hub-purge-sync-runs', '0 3 * * 0', 'select public.hub_purge_old_sync_runs(90);');

    -- Agrégation quotidienne chaque nuit à 02:00 UTC
    begin
      perform cron.unschedule('hub-daily-kpi-rollup');
    exception when others then null;
    end;
    perform cron.schedule('hub-daily-kpi-rollup', '0 2 * * *', 'select public.hub_collect_daily_kpis();');
  end if;
exception when others then
  raise notice 'Planification pg_cron non bloquante : %', sqlerrm;
end $$;
