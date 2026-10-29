# ADR-0039: Canal Descendant Hub-Desktop et Moteur d'Alertes Proactives

## Status

Accepted

## Scope

- Area: Canal descendant Hub -> Desktop, Annonces broadcast, Feature flags, Moteur d'alertes proactives
- Library or platform: SQLite local (better-sqlite3), Supabase PostgreSQL, Next.js
- Installed version: better-sqlite3 12.10.0, @supabase/supabase-js 2.117.3
- Related files:
  - `apps/desktop/lib/api/hub-cache.ts`
  - `apps/desktop/lib/sync/CloudSyncService.ts`
  - `apps/desktop/components/layout/announcement-banner.tsx`
  - `apps/desktop/components/pages/protected-app-shell.tsx`
  - `supabase/migrations/20261028_curatif_hub_alerts_and_channel.sql`
  - `apps/desktop/tests/unit/hub-channel.test.ts`

## Documentation Source

- Context7 source: `@supabase/supabase-js` Realtime / REST queries & SQLite caching patterns
- Official fallback source: Supabase Row Level Security & Materialized Views Documentation
- Date checked: 2026-10-28

## Context

Dans l'architecture Hub & Spoke :
1. Les tables `announcements` et `tenant_flags` existaient côté cloud (Supabase) mais n'étaient jamais consommées par les clients Desktop (dettes Z1 et Z3 du diagnostic). Les administrateurs pouvaient publier des annonces sur le Web Hub, mais aucun utilisateur Desktop ne pouvait les voir.
2. Les alertes (`public.alerts`) dépendaient de règles configurées dans `public.alert_rules` mais aucun moteur SQL automatique n'évaluait ces règles périodiquement pour lever des alertes ou les auto-résoudre lorsque la situation revenait à la normale.

## Decision

Nous implémentons le canal descendant Hub -> Desktop et le moteur d'évaluation des alertes (Lot H du Plan Curatif) :

1. **Table locale `hub_cache` et Service `hub-cache.ts` (H1)** :
   - Création de la table `hub_cache(kind, key, payload, fetched_at)` en SQLite local.
   - Synchronisation descendante `pullHubChannel` dans `CloudSyncService.syncWithCloud` à chaque synchronisation (récupération des annonces actives non expirées et des drapeaux `tenant_flags`).
   - Exposition des helpers typés : `isFlagEnabled(flagKey)`, `getActiveAnnouncements()`.
   - Intégration du composant `AnnouncementBanner` dans `ProtectedAppShell` affichant en temps réel les annonces urgentes (`critical`, `warning`, `maintenance`, `info`) avec option de fermeture pour la session.

2. **Moteur d'Évaluation des Alertes SQL (`hub_evaluate_alerts`) (H2)** :
   - Création de `public.hub_metric_value(metric_name, tenant_id)` extrayant les métriques réelles (erreurs de synchro récentes, jours depuis dernière synchronisation, jours avant expiration de licence).
   - Création de la procédure `public.hub_evaluate_alerts()` :
     - Évalue chaque règle active contre les métriques du tenant.
     - Dédoublonne les alertes : aucune nouvelle alerte n'est créée si une alerte ouverte existe déjà pour la même règle.
     - Auto-résolution automatique : si la métrique repasse sous le seuil critique, l'alerte ouverte passe automatiquement au statut `resolved` avec horodatage.

## Alternatives Considered

- Réception via WebSockets/Supabase Realtime sur le Desktop : rejeté car l'application Desktop est conçue Local-First et hors-ligne ; l'intégration au cycle de synchronisation périodique (toutes les 60 secondes en ligne) est plus robuste, sans connexion TCP persistante inutile.
- Évaluation des alertes côté client : rejeté car le moteur d'alertes doit opérer côté serveur Hub de manière autonome pour superviser l'ensemble de la flotte de postes.

## Risks

- Surcoût réseau si le volume d'annonces archivées est important.
- Mitigation : filtrage strict côté serveur (`is_active = true`, `starts_at <= now()`, `ends_at >= now()`).

## Verification

- `npm run quality:decisions` valide l'arbre des 39 fiches de décisions.
- Tests unitaires `hub-channel.test.ts` (3/3 passés) validant le cache, l'évaluation des flags et le filtrage des annonces expirées.
- `npx tsc --noEmit` sur `apps/desktop` passe avec 0 erreur.
