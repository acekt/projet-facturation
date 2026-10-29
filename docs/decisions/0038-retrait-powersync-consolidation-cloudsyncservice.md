# ADR-0038: Retrait de PowerSync et Consolidation sur CloudSyncService

## Status

Accepted (Supersedes ADR-0018)

## Scope

- Area: Moteur de réplication Cloud, Authentification Supabase, Poids du bundle Desktop
- Library or platform: @supabase/supabase-js, better-sqlite3, PowerSync
- Installed version: @supabase/supabase-js ^2.117.3, better-sqlite3 ^12.10.0 (Suppression de @powersync/web ^2.4.2, @powersync/react ^2.0.2, @journeyapps/wa-sqlite ^2.0.7)
- Related files:
  - `apps/desktop/lib/auth/supabaseSession.ts`
  - `apps/desktop/lib/sync/CloudSyncService.ts`
  - `apps/desktop/components/providers.tsx`
  - `apps/desktop/components/cloud-sync-runner.tsx`
  - `apps/desktop/components/layout/navigation.tsx`
  - `apps/desktop/components/auth/force-password-change-dialog.tsx`
  - `apps/desktop/app/login/login-client.tsx`
  - `docs/archive/sync_rules.yaml`

## Documentation Source

- Context7 source: `/websites/powersync` et `@supabase/supabase-js` authentication sessions
- Official fallback source: PowerSync Web SDK Architecture & Supabase Auth Client
- Date checked: 2026-10-28

## Context

L'application Desktop maintenait deux moteurs de synchronisation concurrents :
1. `CloudSyncService` : moteur natif sur `better-sqlite3` et l'API REST PostgREST Supabase, assurant la réplication transactionnelle bidirectionnelle réelle des données métiers.
2. `PowerSync` (`@powersync/web`, `@powersync/react`, `@journeyapps/wa-sqlite`) : initialisé à l'import, allouant un WebWorker et une base WASM en mémoire même si aucune URL PowerSync dédiée n'était configurée en production. Son connecteur (`SupabaseConnector`) ne servait qu'à maintenir la session JWT Supabase côté client.

Cette dualité introduisait une dette structurelle majeure (Z4 du diagnostic) :
- Allocation de mémoire inutile et surcoût de bundle (~15-20 Mo de WASM et dépendances inutilisées).
- Confusion architecturale entre la réplication locale SQLite native et la réplication WASM navigateur.
- Fichiers `sync_rules.yaml` dupliqués et orphelins.

## Decision

Nous tranchons définitivement le choix du moteur en retirant l'infrastructure PowerSync et en consolidant l'application sur `CloudSyncService` (Lot G du Plan Curatif) :

1. **Extraction de la gestion de session Supabase (`supabaseSession.ts`)** :
   - Remplacement de l'ancien `SupabaseConnector` par un singleton léger `supabaseSession` basé uniquement sur `@supabase/supabase-js` (`createClient`).
   - Centralisation des méthodes d'authentification (`login`, `logout`, `onSessionChange`, `client.auth.getSession`).

2. **Élimination de la couche PowerSync** :
   - Suppression de `apps/desktop/lib/powersync/` (`AppSchema.ts`, `Provider.tsx`, `SupabaseConnector.ts`, `index.ts`, `useAuth.ts`).
   - Suppression du composant d'encapsulation `PowerSyncProvider` dans `components/providers.tsx`.
   - Suppression des dépendances `@powersync/web`, `@powersync/react` et `@journeyapps/wa-sqlite` de `apps/desktop/package.json`.
   - Archivage du fichier de règles dans `docs/archive/sync_rules.yaml`.

3. **Consolidation sur `CloudSyncService`** :
   - Tout échange de données local ↔ cloud repose désormais exclusivement sur `CloudSyncService` renforcé lors du Plan Correctif (curseur composite, soft delete, garde LWW, quarantaine).

## Alternatives Considered

- Migrer entièrement vers PowerSync : rejeté car cela exigerait de remplacer `better-sqlite3` par SQLite WASM dans le navigateur (incompatible avec l'architecture Electron Server Actions de Next.js), de redévelopper toutes les actions serveur, et de souscrire à un service cloud managé PowerSync supplémentaire.
- Conserver le stub PowerSync inactif : rejeté car maintient du code zombie, alloue inutilement des ressources et perturbe la maintenance du projet.

## Risks

- Perte de session client lors de la migration.
- Mitigation : `supabaseSession` réutilise la clé de persistance localStorage standard `@supabase/supabase-js`, préservant la continuité des sessions existantes.

## Verification

- `npx tsc --noEmit` sur `apps/desktop` passe sans aucune erreur.
- `npm run quality:decisions` valide l'arbre des 38 fiches de décisions (ADR-0018 marquée `Superseded by ADR-0038`).
- Suites de tests exécutées avec succès sans mock `@/lib/powersync`.
- Zéro référence à `@powersync` dans le code source de `apps/desktop/`.
