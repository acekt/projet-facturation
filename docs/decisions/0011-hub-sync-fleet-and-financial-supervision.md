# ADR-0011: Supervision Avancée du Parc de Réplication et Gouvernance Financière SaaS

## Status

Accepted

## Scope

- Area: Hub Web / Parc & Synchro / Supervision Financière / Supabase Realtime / Recharts
- Library or platform: Supabase Realtime, PostgreSQL RLS, Next.js 16, Recharts 2.15
- Installed version: @supabase/supabase-js 2.117.3, @supabase/ssr 0.12.7, next 16.4.0, recharts 2.15.0
- Related files: `apps/web-hub/src/app/admin/sync/page.tsx`, `apps/web-hub/src/app/admin/finance/page.tsx`, `apps/web-hub/src/lib/kpi/fleetQueries.ts`, `apps/web-hub/src/lib/kpi/financeQueries.ts`, `apps/web-hub/src/components/admin/sync-fleet-view.tsx`, `apps/web-hub/src/components/admin/finance-overview-view.tsx`

## Documentation Source

- Context7 source: `/supabase/supabase` (Realtime postgres_changes channel subscriptions, analytical SQL rollups), Next.js 16 docs (Server Component data fetching with Suspense)
- Official fallback source: documentation officielle Supabase & Recharts
- Date checked: 2026-10-21

## Context

L'exploitation pérenne d'une architecture Local-First synchronisée Hub & Spoke nécessite un pilotage rigoureux de deux dimensions critiques :
1. **La santé technique de la flotte Desktop** : Détection des postes non synchronisés depuis plus de 7 jours (postes dormants ou isolés), détection des réplications en échec, et mesure des temps de traitement (durée moyenne et percentile p95 en millisecondes).
2. **La gouvernance financière consolidée** : Suivi global des volumes d'affaires émis, des règlements effectifs perçus, des encours clients (créances non réglées) et du taux de recouvrement par tenant pour anticiper les risques d'impayés et orienter les actions commerciales.

## Decision

1. **Module Parc & Synchro (`/admin/sync`)** :
   - Cartographie de la flotte par classes d'âge : actifs récents (< 24h), modérés (24h à 7j), et dormants (> 7j).
   - Télémétrie de performance : calcul de la durée moyenne et du percentile p95 des cycles de réplication (en ms).
   - Fil d'activité en temps réel (`postgres_changes` sur la table `sync_runs`) permettant au Super Admin de voir en direct les postes synchroniser, avec fallback sur rafraîchissement manuel.
   - Journal des erreurs récentes consolidées avec code d'erreur, poste concerné et volume d'enregistrements rejetés.
2. **Module Finance & Volumes (`/admin/finance`)** :
   - Agrégation multi-tenant des montants : CA total facturé (XAF), total encaissé (XAF), créances clients échues et volume des devis en cours.
   - Tableau comparatif des 10 premiers contributeurs de chiffre d'affaires et calcul de leur taux de recouvrement (% payé / facturé).
   - Graphiques interactifs Recharts : tendance mensuelle/hebdomadaire des volumes d'affaires et structure des modes de règlement.
   - Outil d'export CSV pour audit et exploitation comptable externe.

## Alternatives Considered

- Scrutation HTTP par polling intensif toutes les 2 secondes : rejeté pour préserver les quotas réseau et les performances du serveur, au profit des abonnements WebSocket Supabase Realtime.
- Calculer le percentile p95 côté client sur l'ensemble de l'historique : rejeté pour éviter de charger des dizaines de milliers de lignes dans le navigateur ; le calcul est agrégé côté serveur dans le DAL.

## Risks

- En cas de blocage des WebSockets par le pare-feu du réseau Superadmin, l'interface bascule de manière transparente sur les données chargées côté serveur avec bouton d'actualisation instantané.

## Verification

- Command: `npm run quality:decisions`
- Test: Passage des tests de typecheck et validation des requêtes d'agrégation p95 et financière dans la suite de tests
- Manual check: Consultation des pages `/admin/sync` et `/admin/finance` et test de l'export CSV
