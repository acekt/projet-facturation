# ADR-0004: Verrouillage du filtrage multi-tenant (tenant_id) dans SQLite local

## Status

Accepted

## Scope

- Area: Base de données locale / Isolation multi-tenant
- Library or platform: SQLite (`better-sqlite3`), Vitest
- Installed version: better-sqlite3 11
- Related files: `apps/desktop/lib/api/tenant.ts`, `apps/desktop/lib/api/invoice-logic.ts`, `apps/desktop/app/actions/payment.actions.ts`, `apps/desktop/app/actions/credit-note.actions.ts`, `apps/desktop/lib/services/CreditNoteService.ts`, `apps/desktop/tests/unit/multitenant-complete.test.ts`

## Documentation Source

- Context7 source: non requis (architecture SQLite multi-tenant interne)
- Official fallback source: Documentation de l'architecture Hub & Spoke du projet (`.antigravity`, `AGENTS.md`)
- Date checked: 2026-10-20

## Context

Dans une architecture Hub & Spoke offline-first, une base SQLite locale ou partagée sur poste peut contenir ou recevoir des données associées à un `tenant_id`. Il est impératif qu'aucune fuite de données n'intervienne entre tenants, que ce soit à la lecture, à la mise à jour, au recalcul de soldes financiers ou à la suppression d'éléments (factures, devis, clients, services, paiements, avoirs et métriques).

## Decision

1. Appliquer systématiquement le filtre SQL `AND tenant_id = ?` (via `buildTenantFilter(activeTenantId)`) sur toutes les requêtes de lecture, mise à jour (`UPDATE`) et suppression (`softDelete`).
2. Sécuriser `updateInvoiceStatus` avec un paramètre optionnel `tenantId` pour vérifier l'appartenance de la facture et de ses paiements avant tout changement d'état financier (`UNPAID`, `PARTIALLY_PAID`, `PAID`).
3. Verrouiller les requêtes d'agrégation dans `payment.actions.ts` et `credit-note.actions.ts` avec le filtre tenant.
4. Couvrir l'ensemble du périmètre (clients, services, devis, factures, paiements, avoirs, dashboard) par une suite de tests unitaires dédiée `multitenant-complete.test.ts`.

## Alternatives Considered

- RLS SQLite natif : SQLite ne dispose pas de Row-Level Security natif standardisé sans extensions C propriétaires.
- Une base SQLite par tenant sur disque : complexifie le multi-compte et la synchronisation PowerSync sur le poste client.

## Risks

- Données antérieures sans `tenant_id` (`tenant_id IS NULL`).
- Atténuation : `buildTenantFilter` gère `tenant_id IS NULL` via `reconcileLocalTenantId` lors de la synchronisation initiale.

## Verification

- Command: `npx vitest run tests/unit/multitenant-complete.test.ts`
- Test: vérification d'étanchéité stricte entre Tenant Alpha et Tenant Beta sur toutes les entités
- Manual check: `npm run quality:decisions`
