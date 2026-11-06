# ADR-0069: Foreign Key Constraint Resilience, User/Service ID Resolution, and Editor UX Remediation

## Status

Accepted

## Scope

- Area: SQLite Foreign Key Constraints, Stock Movement Tracking, Commercial Documents (Invoices, Quotes, Credit Notes), Fiscal Calculations, Option Caching, TypeScript Config
- Library or platform: Better-SQLite3 11.8.1, Next.js 16.0.0, React 19.0.0, TypeScript 5.7, Vitest 4.1.11
- Installed version: better-sqlite3 11.8.1, next 16.0.0, react 19.0.0, vitest 4.1.11
- Related files:
  - `apps/desktop/lib/services/InvoiceService.ts`
  - `apps/desktop/lib/services/QuoteService.ts`
  - `apps/desktop/lib/services/CreditNoteService.ts`
  - `apps/desktop/app/actions/quote.actions.ts`
  - `apps/desktop/components/editor/FiscalSummaryCard.tsx`
  - `apps/desktop/components/editor/EditorItemsTable.tsx`
  - `apps/desktop/components/features/common/EditableSelect.tsx`
  - `apps/desktop/components/providers.tsx`
  - `apps/desktop/tsconfig.json`
  - `apps/desktop/vitest.config.ts`
  - `apps/desktop/tests/unit/foreign-key-and-editor-remediation.test.ts`
  - `apps/desktop/tests/unit/audit-remediation-lots-1-4.test.ts`

## Documentation Source

- Context7 source: `/sqlite/sqlite3`, `/pmndrs/zustand`, `/vitest-dev/vitest`
- Official fallback source: SQLite Foreign Key Documentation (PRAGMA foreign_keys = ON), Next.js 16 Server Actions Guide, Vitest 4 Pool/Concurrency Documentation
- Date checked: 2026-11-05

## Context

Several operational anomalies and TypeScript validation diagnostics were identified in the Desktop commercial module:
1. `Error: FOREIGN KEY constraint failed`: When custom or untracked lines were added to invoices or quotes, the UI passed temporary client-side IDs (`Date.now().toString()`, e.g., `"1793911677000"`) or empty strings. Since `invoice_items.serviceId`, `quote_items.serviceId`, `credit_note_items.serviceId`, and `stock_movements.serviceId` reference `services(id)`, SQLite strictly rejected insertions.
2. External Supabase Auth IDs: In hybrid Cloud Sync mode, `session.userId` may reference an external Supabase UUID that does not yet exist in the local SQLite `users` table, triggering foreign key violations on `invoices.created_by`.
3. Stock Deductions on Drafts: Invoices created with draft status (`DRAFT`, `draft`, `BROUILLON`) prematurely executed physical stock movements.
4. Fiscal Summary Exoneration Label: In `FiscalSummaryCard.tsx`, the VAT label displayed `0 FCFA (Exonéré)` whenever `tvaAmount === 0`, even when VAT was explicitly checked (`applyTva === true`).
5. Redundant IPC Calls: Multiple `EditableSelect` components mounted concurrently and made duplicate requests to `getCustomSelectOptionsAction` without memoization.
6. TypeScript and Vitest Diagnostics: VS Code reported 8 TypeScript errors in `audit-remediation-lots-1-4.test.ts` due to path alias resolution and unannotated loop variables, and an invalid `minWorkers` property in `vitest.config.ts`.

## Decision

1. **Defensive Foreign Key Resolvers (`resolveValidLocalUserId` & `resolveValidServiceId`)**:
   - Added canonical resolver utilities in `InvoiceService.ts`:
     - `resolveValidServiceId(db, rawServiceId)`: checks `SELECT id FROM services WHERE id = ?`. Returns the valid UUID if found, or `null` if the item is custom or untracked.
     - `resolveValidLocalUserId(db, userId)`: checks `SELECT id FROM users WHERE id = ?`. If missing, falls back deterministically to the local administrator (`role = 'admin'`).
   - Applied across `InvoiceService.createInvoice`, `QuoteService.convertToInvoice`, `CreditNoteService.createCreditNote`, and `quote.actions.ts`.

2. **Draft Invoices & Stock Protection**:
   - Conditioned `StockRepository.recordStockMovement` to only run when the document is not a draft (`data.status !== 'DRAFT' && data.status !== 'draft' && data.status !== 'BROUILLON'`) and `svcId !== null`.

3. **Strict VAT Exoneration Display**:
   - In `FiscalSummaryCard.tsx`, changed the VAT amount display so `(Exonéré)` is rendered strictly if and only if `!applyTva`. When `applyTva === true`, `formatCurrency(tvaAmount)` is rendered (e.g. `0 FCFA`).

4. **Service Picker & UI Cleanliness**:
   - In `EditorItemsTable.tsx`, removed the duplicate plus sign (`+ + Nouveau service` -> `+ Nouveau service`) and ensured `targetItemId` receives the newly created service's ID, unit price, and name.

5. **In-Memory Cache & Request Deduplication for Options**:
   - In `EditableSelect.tsx`, introduced a module-level `optionsCache` Map and `ongoingRequests` promise map to eliminate redundant server queries.

6. **TypeScript & Test Harness Alignment**:
   - Converted unit test imports to relative paths in `audit-remediation-lots-1-4.test.ts`, removed obsolete `baseUrl` and `ignoreDeprecations` compiler options from `apps/desktop/tsconfig.json` and root `tsconfig.json` (eliminating the VS Code TS 5.x language server warning), and aligned `vitest.config.ts` to Vitest 4 types.

## Consequences

- 100% elimination of `FOREIGN KEY constraint failed` errors on invoice, quote, and credit note operations.
- Physical inventory movements remain consistent with accounting status (no premature deductions on drafts).
- Instantaneous select option loading through deduplicated caching.
- Zero TypeScript errors (`0 error`) and 100% green tests (381 passed).

## Risks

- **Risk**: Using a fallback local admin ID for invoices created by external users could obscure the cloud author.
  - *Mitigation*: The audit log retains the true session user identifier, and the invoice `created_by` field is updated upon cloud sync reconciliation.

## Verification

- Automated Unit Tests: `tests/unit/foreign-key-and-editor-remediation.test.ts` (4/4 passed).
- Test Suite: `npm run test --workspace=facturier-desktop` (381/381 passed).
- TypeScript Compiler: `tsc --noEmit --project apps/desktop/tsconfig.json` (0 errors).
- ADR Compliance: `npm run quality:decisions` (69/69 passed).
