# ADR-0061: High-Load Performance Composite Indexes, Lazy Proof Image and Stale-While-Revalidate Zustand Cache

## Status

Accepted

## Scope

- Area: Desktop Performance, Scalability, Local-First Caching and Anti-OOM Memory Protection
- Library or platform: Better-SQLite3, Next.js 16, React 19, Zustand
- Installed version: better-sqlite3 ^11.0.0, next 16.0.0, react 19.0.0, zustand ^5.0.0
- Related files:
  - `apps/desktop/lib/db/migrations/0010_high_load_indexes.ts`
  - `apps/desktop/lib/repositories/LedgerRepository.ts`
  - `apps/desktop/app/actions/ledger.actions.ts`
  - `apps/desktop/lib/store/slices/operationsCacheSlice.ts`
  - `apps/desktop/components/pages/ledger.tsx`
  - `apps/desktop/components/pages/stock.tsx`
  - `apps/desktop/tests/unit/high-load-performance.test.ts`

## Documentation Source

- Context7 source: `/sqlite/sqlite`, `/pmndrs/zustand`, `/vercel/next.js`
- Official fallback source: SQLite Indexing Best Practices & React 19 Transition Architecture
- Date checked: 2026-11-05

## Context

Sous forte charge ou historique volumineux (milliers d'écritures comptables, mouvements de stock et journaux d'audit), l'application desktop risquait des ralentissements sur :
1. Les requêtes `SELECT * FROM ledger_entries` rapatriant systématiquement les chaînes Base64 volumineuses des justificatifs photos (`proofImage`), causant des surcharges mémoire V8 et des lenteurs de sérialisation.
2. Des tempêtes de requêtes (`getLowStockAlerts`, `runCloudSync`) déclenchées à chaque changement de page.
3. Le manque d'index composites sur les clauses combinées `tenant_id`, `deletedAt`, dates et filtres de types/catégories.
4. L'absence de pagination unifiée (`PAGE X SUR Y`) sur le livre des comptes et le catalogue de stock.

## Decision

1. **Index composites SQLite haute performance (Migration 0010)** :
   Création de 7 index composites stratégiques (`idx_ledger_tenant_active_date`, `idx_ledger_tenant_category`, `idx_stock_movements_service_date`, `idx_services_tenant_stock`, `idx_audit_logs_tenant_created`, `idx_payments_tenant_invoice`, `idx_credit_notes_tenant_invoice`).
2. **Anti-OOM Lazy-Loading de `proofImage`** :
   Dans `LedgerRepository.findAll`, omission du champ volumineux `proofImage` au profit d'un indicateur booléen indexable `hasProofImage`. Chargement à la demande de l'image intégrale via `LedgerRepository.getProofImage` uniquement lorsque l'utilisateur consulte le reçu.
3. **Mise en cache Stale-While-Revalidate (Zustand)** :
   Centralisation du catalogue stock, des alertes de stock faible (TTL 60s) et du cache du grand livre avec rafraîchissement en arrière-plan sans bloquer l'UI (`React.startTransition`).
4. **Pagination unifiée standardisée** :
   Intégration du composant `<Pagination />` sur le Grand Livre (15 par page), le Stock (12 par page) et les modales d'historique (10 par page).
5. **Debounce 200ms universel** :
   Filtrage réactif sans latence ni gel de saisie grâce au hook `useDebouncedValue`.

## Alternatives Considered

- Store images on external disk filesystem: Rejected to maintain single-file Local-First SQLite backup and unified replication guarantees.
- Server-side pagination for accounting ledger: Rejected because local SQLite delivers sub-millisecond responses on thousands of rows, and client-side summary calculation preserves instant real-time KPI card updates and global Excel exports.

## Risks

- Stale cache display on concurrent updates: Mitigated by deterministic cache invalidation hooks (`invalidateLedgerCache()`, `refreshStockData(true)`) triggered on all mutating server actions and operations.

## Verification

- Command: `npm run quality:decisions` et `npx tsc --noEmit --project apps/desktop/tsconfig.json`
- Test: `apps/desktop/tests/unit/high-load-performance.test.ts`
- Manual check: Navigation instantanée 0ms entre les modules et vérification de la pagination fluide.
