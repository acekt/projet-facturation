# ADR-0068: Mathematical Concordance, Unified Counter Predicates, and Uncapped Export Center

## Status

Accepted

## Scope

- Area: Data Integrity, Metrics Unification, Audit Logging, Export Center, Financial & Inventory Reconciliation
- Library or platform: React 19, Next.js 16, Zustand, Better-SQLite3, Vitest
- Installed version: next 16.0.0, react 19.0.0, better-sqlite3 11.8.1, vitest 4.1.11
- Related files:
  - `apps/desktop/app/actions/audit.actions.ts`
  - `apps/desktop/app/actions/payment.actions.ts`
  - `apps/desktop/components/features/export/DataExportModal.tsx`
  - `apps/desktop/lib/utils/counters.ts`
  - `apps/desktop/lib/utils/auditFormatter.ts`
  - `apps/desktop/lib/repositories/MetricsRepository.ts`
  - `apps/desktop/components/layout/navigation.tsx`
  - `apps/desktop/components/pages/invoices.tsx`
  - `apps/desktop/components/pages/quotes.tsx`
  - `apps/desktop/components/pages/clients.tsx`
  - `apps/desktop/components/pages/services.tsx`
  - `apps/desktop/components/pages/audit-logs.tsx`
  - `apps/desktop/tests/unit/data-ui-export-consistency.test.ts`

## Documentation Source

- Context7 source: `/sqlite/sqlite3`, `/pmndrs/zustand`, `/vitest-dev/vitest`
- Official fallback source: OHADA Uniform Act on Accounting, SQLite SELECT documentation, Vitest 4 configuration guides
- Date checked: 2026-11-05

## Context

Prior to this harmonization, discrepancies existed between multiple data surfaces across the application:
1. `audit_logs` had a hardcoded `LIMIT 100` in `getAuditLogs()`. Consequently, while the audit page correctly reported the full count (e.g., 163 or 165 logs), the Data Export Modal (`ExportCenterModal`) and its exported CSV/Excel files only contained 100 entries.
2. Invoices, quotes, credit notes, and stock items used slightly divergent counting criteria across the Sidebar badges, Page headers, Dashboard cards, and Export modal tiles. For example, invoices fully offset by credit notes or drafts could cause subtle discrepancies between the "À encaisser" tab and the "Créances à Recouvrer" KPI.
3. The Audit page search input was truncated due to a narrow container, and legacy audit log details contained unformatted currency patterns (e.g., `1072620 XAF` and `Création écriture OUT de 15000 XAF`).

## Decision

1. **Uncapped Audit Logs Retrieval**:
   - `getAuditLogs(limit?: number)` in `audit.actions.ts` now accepts an optional limit parameter, defaulting to complete retrieval (up to 50 000 rows) instead of truncating at 100.
   - Guaranteed `163 === 163` mathematical identity between paginated audit logs and Export Center counters.

2. **Full History Accounting & Inventory in Export Center**:
   - `DataExportModal` executes `getLedgerEntriesAction({})` with no month restriction on mount, ensuring that selecting "Tout l'historique" exports 100% of SQLite ledger history.
   - Initialized and synced `stockItems` with `stockCatalog` to match the "Références suivies" KPI of `stock.tsx`.

3. **Canonical Shared Counter Utility (`lib/utils/counters.ts`)**:
   - Created `isInvoicePendingPayment`: Excludes soft-deleted, `DRAFT`, `CANCELLED`, `PAID`, and invoices whose net remaining balance (`Math.max(0, total - paid - credited)`) is `<= 0`.
   - Created `isPendingQuote`: Excludes soft-deleted, `DRAFT`, `CONVERTI`, `REFUSE`, `EXPIRE`, `CANCELLED`, and quotes where `validUntil < today`.
   - Aligned SQL queries in `MetricsRepository.ts` (`getInvoiceCounts`, `getPendingRevenue`) with the identical net unpaid predicate.
   - Unified Sidebar badges (`navigation.tsx`), tab counters (`invoices.tsx`, `quotes.tsx`, `credit-notes.tsx`), and Export Center tiles.

4. **Visual & Formatting Enhancements**:
   - `audit-logs.tsx` search container styled with `relative flex-1 min-w-[280px] sm:min-w-[360px]` to display the full placeholder without truncation.
   - Enhanced `auditFormatter.ts` with `formatAuditMoneyAndPhrases` to dynamically format patterns like `(\d+)\s*(?:XAF|FCFA)` into space-separated `... FCFA` amounts and convert accounting labels (`Création écriture OUT` -> `Dépense enregistrée : ...`).
   - Allowed clean word wrapping (`whitespace-normal break-words`) in audit event details.

## Consequences

- 100% mathematical concordance across SQLite, Sidebar badges, Page headers, Dashboard KPI cards, and Export Center tiles.
- Zero truncation of audit logs in full system exports.
- Complete visual clarity and compliance with French/OHADA currency formatting conventions.

## Alternatives Considered

- Computing counts via periodic HTTP polling: Rejeté au profit de sélecteurs réactifs dérivés sur le store Zustand et de requêtes SQLite directes pour préserver l'approche Local-First.
- Limiter l'export d'audit à 1 000 lignes : Rejeté au profit d'un plafond élevé (50 000 lignes) garantissant l'intégrité de l'archivage fiscal.

## Risks

- *Risque* : Ralentissement mémoire si un tenant accumule plus de 50 000 entrées d'audit lors d'un export XLSX.
- *Atténuation* : Le streaming CSV et la pagination SQLite `LIMIT 50000` protègent la mémoire du processus Electron.

## Verification

- Command: `node ./node_modules/typescript/bin/tsc --noEmit --project apps/desktop/tsconfig.json`
- Test: `npm run test --workspace=facturier-desktop tests/unit/data-ui-export-consistency.test.ts`
- Decision Quality: `npm run quality:decisions`

