-- ============================================================================
-- Migration : 20261028_correctif_sync_lww_and_kpis.sql
-- Plan Correctif : Lots A1 (D1), A3 (D3), E1 (D7)
-- ============================================================================

-- 1. Index Cloud pour le Curseur Composite Pull (D1)
-- (tenant_id, server_updated_at, id) garantit un ordre total strict sans perte de lignes
create index if not exists idx_tenant_settings_sync2 on public.tenant_settings (tenant_id, server_updated_at);
create index if not exists idx_clients_sync2 on public.clients (tenant_id, server_updated_at, id);
create index if not exists idx_services_sync2 on public.services (tenant_id, server_updated_at, id);
create index if not exists idx_quotes_sync2 on public.quotes (tenant_id, server_updated_at, id);
create index if not exists idx_quote_items_sync2 on public.quote_items (tenant_id, server_updated_at, id);
create index if not exists idx_invoices_sync2 on public.invoices (tenant_id, server_updated_at, id);
create index if not exists idx_invoice_items_sync2 on public.invoice_items (tenant_id, server_updated_at, id);
create index if not exists idx_payments_sync2 on public.payments (tenant_id, server_updated_at, id);
create index if not exists idx_credit_notes_sync2 on public.credit_notes (tenant_id, server_updated_at, id);
create index if not exists idx_credit_note_items_sync2 on public.credit_note_items (tenant_id, server_updated_at, id);
create index if not exists idx_audit_logs_sync2 on public.audit_logs (tenant_id, server_updated_at, id);

-- 2. Garde-Fou LWW & Dérive d'Horloge Côté Serveur (D3)
-- Le serveur ne croit pas aveuglément l'horloge des postes clients.
create or replace function public.sync_lww_guard()
returns trigger
language plpgsql
security definer
as $$
begin
  -- 1) Jamais d'horodatage dans le futur (tolérance de 5 minutes)
  if new.updated_at is not null and new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();
  end if;

  -- 2) Protection Last-Write-Wins : ignorer une écriture cliente plus ancienne que la ligne serveur
  if tg_op = 'UPDATE' and old.updated_at is not null and new.updated_at is not null and new.updated_at < old.updated_at then
    return old;
  end if;

  return new;
end;
$$;

-- Triggers LWW nommés avec prefixe 'trg_00_' pour s'exécuter avant les triggers d'horodatage serveur
drop trigger if exists trg_00_clients_lww on public.clients;
create trigger trg_00_clients_lww before insert or update on public.clients
for each row execute function public.sync_lww_guard();

drop trigger if exists trg_00_services_lww on public.services;
create trigger trg_00_services_lww before insert or update on public.services
for each row execute function public.sync_lww_guard();

drop trigger if exists trg_00_quotes_lww on public.quotes;
create trigger trg_00_quotes_lww before insert or update on public.quotes
for each row execute function public.sync_lww_guard();

drop trigger if exists trg_00_quote_items_lww on public.quote_items;
create trigger trg_00_quote_items_lww before insert or update on public.quote_items
for each row execute function public.sync_lww_guard();

drop trigger if exists trg_00_invoices_lww on public.invoices;
create trigger trg_00_invoices_lww before insert or update on public.invoices
for each row execute function public.sync_lww_guard();

drop trigger if exists trg_00_invoice_items_lww on public.invoice_items;
create trigger trg_00_invoice_items_lww before insert or update on public.invoice_items
for each row execute function public.sync_lww_guard();

drop trigger if exists trg_00_payments_lww on public.payments;
create trigger trg_00_payments_lww before insert or update on public.payments
for each row execute function public.sync_lww_guard();

drop trigger if exists trg_00_credit_notes_lww on public.credit_notes;
create trigger trg_00_credit_notes_lww before insert or update on public.credit_notes
for each row execute function public.sync_lww_guard();

drop trigger if exists trg_00_credit_note_items_lww on public.credit_note_items;
create trigger trg_00_credit_note_items_lww before insert or update on public.credit_note_items
for each row execute function public.sync_lww_guard();

-- 3. Planification Explicite du Rollup KPI (Lot E1 / D7)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('hub-daily-kpi-rollup');
    exception when others then null;
    end;

    perform cron.schedule('hub-daily-kpi-rollup', '0 2 * * *', 'select public.hub_collect_daily_kpis();');
    raise notice 'pg_cron : hub-daily-kpi-rollup planifié avec succès.';
  else
    raise notice 'pg_cron non actif. L''agrégation devra être appelée via Vercel Cron ou manuellement.';
  end if;
end $$;
