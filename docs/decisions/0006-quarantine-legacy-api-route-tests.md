# ADR-0006: Quarantaine des suites de tests legacy basées sur les routes API supprimées

## Status

Accepted

## Scope

- Area: Qualité / Tests
- Library or platform: Vitest 4
- Installed version: vitest 4.1.11
- Related files: `apps/desktop/vitest.config.ts`, `apps/desktop/tests/integration/*`, `apps/desktop/tests/performance/*`

## Documentation Source

- Context7 source: non requis (option `test.exclude` de Vitest, déjà utilisée dans la configuration)
- Official fallback source: documentation Vitest, option `exclude`
- Date checked: 2026-10-20

## Context

Le desktop est passé des routes API Next.js (`app/api/**/route.ts`) aux Server Actions (`app/actions/*`). 19 suites de `tests/integration` et `tests/performance` importent encore ces routes supprimées : elles échouent à l'import (0 test exécuté, 0 test en échec) et rendent `turbo run test` rouge, ce qui masque les vraies régressions.

## Decision

1. Exclure ces 19 suites par une liste nominative `LEGACY_QUARANTINE` dans `vitest.config.ts`, et non par un glob de dossier.
2. Migrer chaque suite vers les Server Actions puis la retirer de la liste, étape par étape.
3. Toute nouvelle suite dans `tests/integration` ou `tests/performance` reste exécutée par défaut.

## Alternatives Considered

- Supprimer les suites : rejeté, elles décrivent des scénarios métier (flux financier, RBAC, onboarding) à conserver.
- Migrer les 19 suites immédiatement : rejeté pour cette étape, effort important et sans lien avec le typecheck.
- Exclure les dossiers entiers par glob : rejeté, cela masquerait aussi les futures suites valides.

## Risks

- Couverture d'intégration réduite tant que la migration n'est pas faite.
- Atténuation : la liste est nominative, versionnée et référencée ici ; les suites `unit` et `security` couvrent déjà RBAC, multi-tenant et chiffrement.

## Verification

- Command: `npx turbo run test --filter=facturier-desktop`
- Test: la suite desktop doit passer sans suite en échec
- Manual check: `npm run quality:decisions`
