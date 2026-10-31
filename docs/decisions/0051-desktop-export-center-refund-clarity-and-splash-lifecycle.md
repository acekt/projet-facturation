# ADR-0051: Desktop Export Center, Refund Clarity and Splash Lifecycle

## Status

Accepted

## Scope

`apps/desktop` (Export Center modal, Credit Notes refund clarity, Splash to Main Window lifecycle handoff, Memory ceiling hardening).

## Documentation Source

- Electron Lifecycle & BrowserWindow API (`ready-to-show`, `webContents`, contextBridge IPC contract).
- React 19 Client Components & Hydration Mount Life-cycle.
- OHADA Uniform Act on Commercial Law & General Accounting (Credit Note / Avoir accounting impact and refund receipts).
- Architecture & Monorepo Directives (`.antigravity`, Rule M-400, Local-First SQLite).

## Context

Several subtle visual and operational anomalies were identified across the Facturier desktop application:
1. When starting the application, after the splash screen a momentary blank white screen appeared before the login/dashboard screen because `did-finish-load` fired before React was hydrated.
2. In the Credit Notes view (`apps/desktop/components/features/credit-notes/CreditNoteViews.tsx`), users could not see the actual refund or deduction status of the credit note itself, nor the resulting updated invoice balance.
3. The "Export Excel" action was rigid and directly exported default columns without allowing the user to select specific scopes (Factures, Devis, Avoirs, Clients), periods (30 days, quarter, year, custom range), statuses, or output formats (Excel .xlsx with corporate styling vs universal OHADA CSV with UTF-8 BOM).
4. Memory allocation crashes occurred under development mode when Webpack packfile cache built up.

## Decision

1. **Deterministic Splash Handoff**: `Providers` emits `window.electron.reportAppReady()` on client mount. `mainWindow` in `main/window.js` delays revealing the window until this signal is received (or a safety guard timeout occurs), completely eliminating the blank screen.
2. **Interactive Export Center (`DataExportModal.tsx`)**: Replaced direct one-click downloads on Factures, Devis, and Avoirs pages with a modal allowing multi-criteria filtering, live document and currency total count, and instant export in either styled `.xlsx` or RFC 4180 `.csv`.
3. **Credit Notes Refund Clarity**: Added an explicit "Remboursé / Déduit" status badge for credit notes and surfaced the resulting invoice balance directly in the table and grid card views.
4. **Node Memory Ceiling**: Bumped `--max-old-space-size` to 8192 MB for `dev` and purged stale Next.js cache.

## Risks

- **Export Volume**: Exporting large multi-year datasets in memory could spike client memory.
  - *Mitigation*: Streaming ExcelJS rows and in-memory Blob cleanup via `URL.revokeObjectURL`.
- **Offline / Non-Electron Fallback**: When running in browser mode, `window.electron` is undefined.
  - *Mitigation*: Safe optional chaining (`window.electron?.reportAppReady`).

## Verification

- `npm run quality:desktop-health` validates that 100% of desktop production files respect Rule M-400 (< 400 lines).
- `npm run typecheck` passes with zero TypeScript errors across all monorepo packages.
- `npm run quality:decisions` validates all 51 ADR records.
- Vitest suite in `apps/desktop` passes.

