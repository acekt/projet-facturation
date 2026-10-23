# ADR-0008: Modèle de Données SaaS, Télémétrie Flotte Desktop et Agrégation des KPIs

## Status

Accepted

## Scope

- Area: Hub Web / Modélisation SaaS / Télémétrie Flotte Desktop / Agrégations KPI
- Library or platform: PostgreSQL, Supabase, pg_cron, TypeScript, Electron Desktop
- Installed version: @supabase/supabase-js 2.117.3, better-sqlite3 11.8.1
- Related files: `supabase/migrations/20261021_hub_telemetry_kpis.sql`, `apps/desktop/lib/sync/CloudSyncService.ts`, `apps/desktop/lib/device/deviceId.ts`, `apps/desktop/lib/sync/TelemetryReporter.ts`

## Documentation Source

- Context7 source: `/supabase/supabase` (pg_cron scheduled jobs, PL/pgSQL rollups, RPC analytics), Next.js 16 docs
- Official fallback source: documentation officielle Supabase & PostgreSQL
- Date checked: 2026-10-20

## Context

Pour opérer le SaaS Hub & Spoke et suivre les indicateurs de performance clés (MRR, churn, rétention, cohortes, volumes de facturation, santé de la synchronisation et anomalies), le Super Admin a besoin de données agrégées fiables et d'une visibilité en temps réel sur la flotte de postes connectés.
Jusqu'alors, la base Supabase ne stockait ni le statut d'abonnement des tenants, ni les postes de travail Desktop (`device_id`, version, OS), ni les journaux de réplication (`sync_runs`). De plus, aucune table d'agrégation quotidienne n'existait, ce qui aurait imposé des calculs lents et coûteux à la volée sur des millions de lignes de facturation. Enfin, le Desktop ne disposait d'aucune porte de licence pour appliquer les suspensions administratives décidées sur le Hub.

## Decision

1. **Extension du schéma PostgreSQL Cloud** :
   - Enrichissement de `public.tenants` avec `status` ('active', 'trial', 'suspended', 'expired'), `plan_id`, `trial_ends_at`, `license_expires_at`, `country`, `suspended_reason` et `notes`.
   - Table `public.plans` (tarifs en XAF, quotas d'utilisateurs et de postes, fonctionnalités en JSONB).
   - Table `public.sync_devices` (inventaire des postes, `device_id`, OS, version de l'application, horodatages de première/dernière vue et dernier statut).
   - Table `public.sync_runs` (journal d'exécution des synchronisations : durée, push/pull/delete, erreurs techniques, purge automatique à 90 jours).
   - Table `public.kpi_tenant_daily` (agrégations par tenant et par jour : documents créés, volume en XAF, utilisateurs actifs, synchros, échecs).
   - Tables de gouvernance `alert_rules`, `alerts`, `announcements` et `tenant_flags`.
2. **Procédure d'agrégation quotidienne et purge** :
   - Fonction PL/pgSQL `public.hub_collect_daily_kpis(p_date date)` calculant les métriques d'activité par tenant de manière idempotente (UPSERT sur `unique(tenant_id, metric_date)`).
   - Fonction `public.hub_purge_old_sync_runs(p_days int default 90)` pour maîtriser la volumétrie.
   - Programmation via `pg_cron` (ou déclenchement à la demande / webhook) à 02:00 UTC.
3. **Télémétrie Desktop non-intrusive et porte de licence** :
   - Côté Desktop, génération d'un `device_id` (UUIDv4 persistant stocké localement).
   - À chaque fin de cycle `syncWithCloud`, transmission asynchrone du rapport technique (`duration_ms`, `pushed`, `pulled`, `errors`) vers `sync_runs` et `sync_devices`. Aucune donnée nominative ou métier n'est transmise dans ce flux.
   - Porte de contrôle de licence : au début de la synchronisation, `CloudSyncService` vérifie la validité du tenant. En cas de suspension (`status = 'suspended'`) ou d'expiration, la synchronisation est interrompue avec notification claire à l'opérateur, sans altérer la base SQLite locale.

## Alternatives Considered

- Calculer tous les KPI à la volée à chaque ouverture du Hub : rejeté car cela entraînerait des scans complets des tables de facturation et une latence inacceptable.
- Télémétrie poussée incluant les noms des clients et articles : rejeté car contraire au principe de confidentialité stricte et de minimisation des données.
- Bloquer l'accès hors-ligne local si la licence expire : rejeté car l'application locale-first doit permettre la consultation des données existantes en cas de coupure réseau, la restriction ne portant que sur la réplication cloud.

## Risks

- Perte de connexion Internet lors de l'envoi de télémétrie : la remontée technique échoue silencieusement sans bloquer la facturation locale de l'entreprise.
- Environnement Supabase sans extension pg_cron : la fonction `hub_collect_daily_kpis` peut être invoquée directement via une tâche planifiée externe (GitHub Actions, Edge Function ou cron système).

## Verification

- Command: `npm run quality:decisions`
- Test: Validation de l'idempotence des fonctions de rollup et du rapport de télémétrie Desktop
- Manual check: Exécution de la migration SQL sur Supabase et vérification de l'insertion dans `sync_devices`
