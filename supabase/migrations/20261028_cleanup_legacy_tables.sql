-- ============================================================================
-- MIGRATION : Nettoyage des Résidus de Migration *_legacy (H3 / Z2)
-- NOTE : À exécuter uniquement après validation explicite (conformité Z2).
-- ============================================================================

do $$
declare
  clients_count int := 0;
  invoices_count int := 0;
begin
  -- 1. Contrôle préalable : les tables legacy doivent être vides
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'clients_legacy') then
    execute 'select count(*) from public.clients_legacy' into clients_count;
    if clients_count > 0 then
      raise exception 'ABORT: public.clients_legacy contient % lignes. Sauvegarde requise avant suppression.', clients_count;
    end if;
    drop table public.clients_legacy cascade;
    raise notice 'Table public.clients_legacy supprimée proprement.';
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'invoices_legacy') then
    execute 'select count(*) from public.invoices_legacy' into invoices_count;
    if invoices_count > 0 then
      raise exception 'ABORT: public.invoices_legacy contient % lignes. Sauvegarde requise avant suppression.', invoices_count;
    end if;
    drop table public.invoices_legacy cascade;
    raise notice 'Table public.invoices_legacy supprimée proprement.';
  end if;
end $$;
