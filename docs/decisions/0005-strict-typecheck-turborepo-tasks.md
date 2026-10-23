# ADR-0005: Typecheck strict du monorepo et orchestration Turborepo 2.x

## Status

Accepted

## Scope

- Area: Qualité du monorepo / Build / TypeScript
- Library or platform: Turborepo 2.11, TypeScript 5, Next.js
- Installed version: turbo 2.11.9
- Related files: `turbo.json`, `package.json`, `apps/desktop/next.config.mjs`, `apps/desktop/types/electron.d.ts`, `apps/desktop/lib/services/SetupService.ts`, `apps/desktop/lib/sync/CloudSyncService.ts`, `apps/web-hub/package.json`, `packages/database/package.json`

## Documentation Source

- Context7 source: `/vercel/turborepo` v2.11.7 (codemod `rename-pipeline`, clé `tasks`)
- Official fallback source: documentation officielle Turborepo
- Date checked: 2026-10-20

## Context

`apps/desktop` compilait avec `typescript.ignoreBuildErrors: true`, ce qui masquait 9 erreurs TypeScript réelles (déclaration manquante de `window.electron`, UUID typé trop étroitement, signature de `markSynced`). `turbo.json` utilisait encore la clé `pipeline`, supprimée en Turborepo 2.x, Turbo n'était pas déclaré en dépendance et aucune tâche `typecheck` n'existait. `@workspace/database` (types `I*` et moteur fiscal) existait déjà mais le web-hub ne le déclarait pas.

## Decision

1. Retirer le masquage : `ignoreBuildErrors: false` dans `apps/desktop/next.config.mjs`.
2. Corriger les 9 erreurs à la source : `types/electron.d.ts` (contrat `IElectronBridge`), types `string` dans `SetupService`, type structurel de `markSynced`.
3. Migrer `turbo.json` vers `tasks` et ajouter `typecheck`, `test`, `lint`.
4. Déclarer `turbo` en devDependency racine, fixer `packageManager`, exposer `npm run typecheck|test|lint`.
5. Ajouter un script `typecheck` à `desktop`, `web-hub` et `@workspace/database`, et déclarer `@workspace/database` dans le web-hub.

## Alternatives Considered

- Conserver `ignoreBuildErrors: true` et corriger plus tard : rejeté, la dette serait invisible et croissante.
- Déclarer `window.electron` en `any` : rejeté, perd la vérification du contrat preload.
- Utiliser `npx turbo` sans dépendance épinglée : rejeté, version non reproductible entre postes et CI.

## Risks

- Tout build desktop échoue désormais sur une erreur de type.
- `types/electron.d.ts` doit rester synchronisé avec `preload.js`.
- Un cache `tsconfig.tsbuildinfo` périmé peut afficher de fausses erreurs : le supprimer en cas de doute.

## Verification

- Command: `npx turbo run typecheck`
- Test: 3 paquets en succès (`@workspace/database`, `facturier-desktop`, `web-hub`)
- Manual check: `npm run quality:decisions`
