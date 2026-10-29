# ADR-0042: Harmonisation de la Chaîne d'Outils, Dédoublonnage des Dépendances, Convention Proxy Next.js 16 et Rétablissement de la Minification

## Status

Accepted

## Scope

- Area: Chaîne d'outils (Toolchain), Packaging Next.js / Electron, Dépendances de production et de développement
- Library or platform: Next.js 16.4.3, React 19.2.0, TypeScript 5.9.3, Turborepo 2.11.9
- Installed version: facturier-desktop@1.0.0, web-hub@0.1.0, @workspace/ui@1.0.0, @workspace/database@1.0.0
- Related files:
  - `package.json` (racine)
  - `apps/desktop/package.json`
  - `apps/web-hub/package.json`
  - `packages/ui/package.json`
  - `packages/database/package.json`
  - `apps/desktop/next.config.mjs`
  - `apps/desktop/proxy.ts`
  - `apps/desktop/middleware.ts`

## Documentation Source

- Context7 source: `/vercel/next.js`, `/microsoft/typescript`
- Official fallback source: Documentation officielle Next.js 16 (Middleware and Proxy convention, Standalone output), Documentation officielle React 19
- Date checked: 2026-10-28

## Context

Dans le cadre du plan curatif (Lot K, actions P1, P3, P4, P8) et de la revue technique du monorepo :
1. **Désactivation artificielle de la minification (P1)** : Dans [apps/desktop/next.config.mjs](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/apps/desktop/next.config.mjs), la minification Webpack avait été neutralisée via `config.optimization.minimize = false` pour contourner un dépassement de mémoire (OOM) lors des builds Windows/CI. Cette désactivation alourdissait significativement le bundle standalone empaqueté dans Electron.
2. **Duplication massive des dépendances UI (P4)** : 14 packages `@radix-ui/*`, `cmdk`, `date-fns` et `react-day-picker` étaient déclarés simultanément dans `apps/desktop/package.json` et `packages/ui/package.json`, alors que l'application Desktop n'importe aucun composant Radix en direct, déléguant l'intégralité des briques d'interface au workspace `@workspace/ui`.
3. **Divergence de versions dans le monorepo (P3)** :
   - TypeScript variait entre `^5.0.0` et `5.9.3` selon les packages.
   - React oscillait entre `^19.2.0` dans le Desktop et `19.3.0` dans `web-hub`.
   - `@types/node` variait entre `^22.20.1` et `20.19.43`.
4. **Transition conventionnelle Next.js 16 (P8)** : Next.js 16 introduit `proxy.ts` en remplacement conventionnel de `middleware.ts` pour clarifier son exécution au niveau du reverse proxy Node.js, tout en nécessitant de préserver l'exemption de la route `/api/health` critique pour le healthcheck de l'orchestrateur Electron (ADR-0022).

## Decision

1. **Rétablissement de la minification et allocation mémoire adéquate (K3 / P1)** :
   - Retrait de `config.optimization.minimize = false` dans `apps/desktop/next.config.mjs`.
   - Configuration de `cross-env NODE_OPTIONS="--max-old-space-size=4096"` dans les scripts de compilation et d'exécution des tests Vitest sous Windows pour éliminer tout risque d'épuisement du tas (heap OOM).
2. **Dédoublonnage strict des packages UI (K2 / P4)** :
   - Retrait de `apps/desktop/package.json` des 14 dépendances `@radix-ui/*`, de `cmdk`, `react-day-picker` et `date-fns`.
   - Transfert de la dépendance `cmdk` dans `packages/ui/package.json` où `src/components/command.tsx` la consomme.
   - Déplacement de `@workspace/ui` vers la section `dependencies` de `apps/desktop/package.json`.
3. **Harmonisation globale des versions (K1 / P3)** :
   - Pillage de TypeScript à `5.9.3` à la racine (`devDependencies`), ainsi que dans `packages/ui`, `packages/database`, `apps/desktop` et `apps/web-hub`.
   - Pillage de React et React-DOM à `^19.2.0` dans `apps/web-hub` et `apps/desktop`.
   - Pillage de `@types/node` à `^22.20.1` dans `apps/web-hub` et `apps/desktop`.
4. **Adoption de la convention `proxy.ts` Next.js 16 (K4 / P8)** :
   - Création de `apps/desktop/proxy.ts` exportant la fonction `proxy` assurant le contournement de l'authentification pour `/api/health` et les assets statiques (`_next/static`, `_next/image`, `favicon.ico`).
   - Maintien d'un re-export rétrocompatible dans `apps/desktop/middleware.ts` (`export { proxy as middleware, proxy }`) pour sécuriser les tests de régression existants.
5. **Évaluation des montées de version majeures futures (K5)** :
   - Les passages majeurs (`zod` 3→4, `recharts` 2→3, Electron 42→44) feront l'objet d'ADRs dédiés et d'évaluations isolées afin d'éviter tout effet de bord sur la synchronisation et le packaging natif.

## Risks

- **Risque de module manquant au runtime si un composant UI importait directement un sous-module Radix** : Mitigé par une vérification grep exhaustive confirmant 0 import direct de `@radix-ui/*` dans `apps/desktop`.
- **Risque de régression du contournement `/api/health`** : Mitigé par la préservation stricte de la condition d'exemption `pathname === '/api/health'` et les tests d'intégration du serveur desktop.

## Verification

- `npm run typecheck` exécuté via Turborepo sur les 4 packages (`facturier-desktop`, `web-hub`, `@workspace/ui`, `@workspace/database`) avec 0 erreur.
- Suites de tests unitaires Vitest de pages UI et de composants exécutées avec succès.
- Contrôle de cohérence `npm run quality:decisions`.
