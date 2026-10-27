# ADR-0028: Assainissement Curatif et Intégrité Référentielle du Module 1 (Clients & Services)

## Status

Accepted

## Scope

- Area: apps/desktop
- Library or platform: Next.js 16 Server Actions, SQLite (better-sqlite3), PowerSync Local-First, React 19
- Installed version: Next.js 16.4.3, React 19.2.0, better-sqlite3 12.6.2
- Related files:
  - `apps/desktop/app/actions/client.actions.ts`
  - `apps/desktop/app/actions/service.actions.ts`
  - `apps/desktop/lib/utils.ts`
  - `apps/desktop/components/pages/clients.tsx`
  - `apps/desktop/components/pages/services.tsx`
  - `apps/desktop/components/pages/invoice-editor.tsx`
  - `apps/desktop/components/pages/quote-editor.tsx`
  - `apps/desktop/tests/unit/module1-curative.test.ts`

## Documentation Source

- Context7 source: Next.js Server Actions error handling and validation with Zod (`https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/forms.mdx`)
- Official fallback source: `node_modules/next/dist/docs/` & SQLite RFC 4180 CSV Standard
- Date checked: 2026-10-27

## Context

L'audit approfondi du Module 1 (Clients & Services / Prestations) a identifié des anomalies et parasites compromettant l'intégrité des données et l'expérience utilisateur :
1. **Bug critique de détection de doublons d'email client** : La requête filtrait par `created_by = session.userId`. Deux administrateurs ou opérateurs d'une même organisation pouvaient créer le même client sans détection de doublon.
2. **Absence de contrôle de doublon lors de la mise à jour client (`updateClient`)** : Un utilisateur pouvait réattribuer l'email d'un client existant à un autre client sans aucune restriction.
3. **Absence de détection de doublons dans le catalogue de services (`createService` / `updateService`)** : Il était possible d'insérer des prestations avec des noms identiques dans le même tenant, polluant le répertoire et faussant les autocomplétions lors de la saisie des devis et factures.
4. **Fragilité de l'extraction des initiales Avatar (`.split(" ")`)** : Les espaces multiples (ex: `"Total   Gabon"`) provoquaient des éléments vides où `n[0]` pouvait valoir `undefined`.
5. **Vulnérabilité et tronquage de l'export CSV** :
   - Dans `clients.tsx` et `services.tsx`, l'export CSV ne protégeait pas les cellules contenant des virgules, retours à la ligne ou guillemets (décalage de colonnes selon RFC 4180).
   - Dans `services.tsx`, l'export n'exportait que la page active courante (`paginatedServices`) au lieu de l'ensemble des données du catalogue.

## Decision

1. **Isolation Multi-Tenant et Dédoublonnage Strict** :
   - Suppression du filtre `created_by` pour le contrôle d'unicité d'email dans `client.actions.ts` ; filtrage désormais strictement borné par `lower(email)` et `tenant_id` actif.
   - Ajout d'une vérification d'unicité email lors de `updateClient` avec exclusion de l'enregistrement courant (`id != ?`).
   - Ajout de vérifications d'unicité insensibles à la casse (`lower(name)`) et nettoyées des espaces superflus (`trim()`) pour les services dans `service.actions.ts` (`createService` et `updateService`).
2. **Robustesse et Centralisation des Utilitaires UI (`lib/utils.ts`)** :
   - Implémentation de `getInitials(name, fallback)` : gestion propre des espaces multiples via `split(/\s+/)`, retour des 2 premières lettres pour les entreprises à nom unique (ex: `"Airtel"` -> `"AI"`), et fallback sécurisé `"CL"`.
   - Remplacement des extractions manuelles fragiles dans `clients.tsx`, `services.tsx`, `invoice-editor.tsx` et `quote-editor.tsx`.
   - Implémentation de `escapeCsvCell(val)` : encadrement systématique par guillemets et échappement doublé des guillemets intérieurs selon le standard RFC 4180.
3. **Fiabilisation de l'Export CSV** :
   - Export de la totalité des éléments (ou des éléments filtrés par la recherche en cours) plutôt que de la seule page affichée.
4. **Validation par Suite de Tests Dédiée** :
   - Création de `tests/unit/module1-curative.test.ts` couvrant l'intégrité des dédoublonnages, l'isolation multi-tenant, et la robustesse des utilitaires (8/8 tests passés avec succès).

## Risks

- Rejet des doublons légitimes dans des tenants distincts : Nul, car la clause `buildTenantFilter` garantit l'indépendance totale entre tenants.
- Performance des vérifications SQLite : Négligeable grâce aux index existants sur `tenant_id` et `deletedAt`.

## Consequences

- Intégrité parfaite du catalogue de prestations et de la base client.
- Zéro régression : 201/201 tests réussis sur le client lourd desktop, compilation TypeScript immaculée.

## Verification

- Command: `npm run quality:decisions`
- Test: `npx vitest run tests/unit/module1-curative.test.ts` (8/8 passés) et `npm run test` (201/201 passés)
- Manual check: Export CSV exempt de décalage de colonnes, initiales d'avatar cohérentes pour entreprises à mot unique ou multiples.
