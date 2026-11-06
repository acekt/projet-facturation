# ADR-0060: UX Stock Item Distinction, Editable Select Options, Audit & RBAC Clarity, Excel SpreadsheetML Exports, and Multi-Page A4 Rendering

## Status

Accepted

## Scope

- Area: Desktop Services & Stock, Credit Notes, Audit Trail, Users/RBAC, Payments & General Ledger, Excel Exports, Multi-Page A4 Document Rendering
- Library or platform: Electron, Next.js 16, React 19, Better-SQLite3, Tailwind CSS, Vitest
- Installed version: Electron 34+, Next.js 16.4.3, React 19.2.0, Better-SQLite3 11.x
- Related files:
  - `apps/desktop/lib/db/migrations/0009_ux_stock_audit_ledger_excellence.ts`
  - `apps/desktop/components/features/common/EditableSelect.tsx`
  - `apps/desktop/app/actions/custom-options.actions.ts`
  - `apps/desktop/components/pages/services/ServiceFormDialog.tsx`
  - `apps/desktop/components/pages/stock/StockHistoryDialog.tsx`
  - `apps/desktop/components/pages/stock.tsx`
  - `apps/desktop/components/features/credit-notes/CreditNoteViews.tsx`
  - `apps/desktop/components/pages/credit-notes.tsx`
  - `apps/desktop/components/pages/audit-logs.tsx`
  - `apps/desktop/lib/utils/auditFormatter.ts`
  - `apps/desktop/components/pages/users.tsx`
  - `apps/desktop/components/pages/users/UserTableRow.tsx`
  - `apps/desktop/components/pages/invoices/PaymentDialog.tsx`
  - `apps/desktop/components/pages/ledger/LedgerEntryDialog.tsx`
  - `apps/desktop/components/pages/ledger/LedgerEntryDetailsDialog.tsx`
  - `apps/desktop/components/pages/ledger.tsx`
  - `apps/desktop/lib/utils/excel-export.ts`
  - `apps/desktop/components/document-a4.tsx`
  - `apps/desktop/components/fullscreen-document-viewer.tsx`
  - `apps/desktop/lib/electron-print.ts`

## Documentation Source

- Context7 source: `/vercel/next.js` (Server Actions & validation separation), `/electron/electron` (`webContents.printToPDF` multi-page A4 print media), `/radix-ui/primitives` (Dialog & Select focus ring and accessibility)
- Official fallback source: Microsoft Office XML SpreadsheetML Specification, W3C CSS Paged Media Module Level 3 (`@page`, `break-inside: avoid`, `thead { display: table-header-group }`)
- Date checked: 2026-11-05

## Context

An end-to-end UX, accounting, and visual audit identified eight areas requiring surgical improvements:
1. Commercial service titles (e.g., `"Achat et installation d'extincteur ABC 1 KG"`) were conflated with physical inventory item names (`"Extincteur ABC 1 KG"`), and the Stock History modal lacked search/filter/sort controls while displaying a harsh blue focus ring on the close button.
2. Credit Notes (`credit-notes.tsx` & `CreditNoteViews.tsx`) had divergent filtering logic between top counters and list cards, lacked chronological/amount sorting, and had inconsistent left border thicknesses.
3. Audit Logs (`audit-logs.tsx`) displayed raw ISO timestamps (`2026-11-04 16:40:26`) instead of localized French dates (`04/11/2026 à 16:40:26`), had some `"Système"` fallbacks during share events, and lacked action/entity/sort filter controls.
4. Users & RBAC (`users.tsx` & `UserTableRow.tsx`) truncated `"Administrateur"` in narrow selects, showed raw `"operator"` badges, and lacked an explicit summary of Administrator vs Operator permissions.
5. Select dropdowns across the app were static, payment references had to be typed manually, and General Ledger entries could not store an optional receipt/proof image (`proofImage`) or enforce admin-only deletion in the UI.
6. CSV exports lacked native Excel styling, column widths, borders, and currency formatting.
7. A4 documents (`DocumentA4`, `A4FiscalSummary`, `A4Footer`, `electron-print.ts`) had fixed single-page height rules that clipped 15+ line documents, omitted full recipient details (`NIF`, `RCCM`, `phone`, `email`, `address`), duplicated bank/payment conditions in the footer, and lacked a direct `"Partager"` button in `FullScreenDocumentViewer`.

## Decision

1. **Migration `0009_ux_stock_audit_ledger_excellence` (`version: 9`)**:
   - Added `stockItemName TEXT` on `services` (with automatic backfill stripping commercial prefixes), `proofImage TEXT` on `ledger_entries`, and the `custom_select_options` table (`groupKey`, `value`, `label`, `tenant_id`).
   - Backfilled missing `payments.reference` (`REG-YYYYMMDD-XXXX`), `audit_logs.userName`, and fixed `"date démission"` typos in `settings.paymentTerms`.
2. **Zero-Cascade `<EditableSelect />` Component**:
   - Implemented `EditableSelect.tsx` backed by `custom-options.actions.ts` allowing users to add or delete custom dropdown options per `groupKey` (`service_category`, `service_unit`, `payment_method`, `credit_note_reason`, `ledger_category_in`, `ledger_category_out`) without modifying or deleting existing records.
3. **Stock, Credit Notes, Audit Logs, Users & Ledger Enhancements**:
   - Separated `stockItemName` from `name` in `ServiceFormDialog.tsx`, `stock.tsx`, and `StockHistoryDialog.tsx`, and added search/type/sort filters to `StockHistoryDialog`.
   - Unified `getEffectiveCreditNoteCategory` across `credit-notes.tsx` and `CreditNoteViews.tsx`, added sort and widened search controls, and standardized card borders.
   - Standardized French timestamps (`JJ/MM/AAAA à HH:mm:ss`) and filters in `audit-logs.tsx`, and added RBAC role badges, French login timestamps, and a permissions banner in `users.tsx`.
   - Added auto-generated references (`REG-YYYYMMDD-XXXX`) in `PaymentDialog.tsx` and `LedgerEntryDialog.tsx`, optional receipt image upload/preview (`proofImage`) in `LedgerEntryDialog.tsx` / `LedgerEntryDetailsDialog.tsx` / `ledger.tsx`, and restricted ledger deletion to Administrators.
4. **Native Styled Excel Exporter & Multi-Page A4 Print Engine**:
   - Created `excel-export.ts` generating styled SpreadsheetML `.xls` workbooks (navy header `#0F2942`, explicit column widths, `#E2E8F0` grid borders, `#,##0 "FCFA"` currency cells, and bold totals row).
   - Configured multi-page A4 flow (`thead { display: table-header-group }`, `tr { break-inside: avoid }`, `.a4-fiscal-summary { break-inside: avoid }`), enriched the `DESTINATAIRE` block in `document-a4.tsx`, deduplicated `A4Footer.tsx`, and added the `"Partager"` button in `fullscreen-document-viewer.tsx`.

## Alternatives Considered

- Mutate historical records when removing a dropdown option in `EditableSelect`: Rejected to preserve accounting and historical integrity (zero-cascade deletion only removes the suggestion from `custom_select_options`).
- Keep CSV-only exports: Rejected because unformatted CSV files require manual column resizing and number formatting in Excel.

## Risks

- Large receipt images in SQLite `ledger_entries.proofImage`: Mitigated by client-side canvas compression (max 1000px, JPEG 0.75 quality) before storing the Data URL.

## Verification

- Command: `npm run quality:decisions`
- Command: `npx tsc --noEmit --project apps/desktop/tsconfig.json`
- Test: `npx vitest run --config apps/desktop/vitest.config.ts`
