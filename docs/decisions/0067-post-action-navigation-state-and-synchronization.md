# ADR-0067: Post-Action Navigation Lifecycle, Anti-Deadlock Safety Nets, and Multi-Module State Synchronization

## Status

Accepted

## Scope

- Area: Navigation Flow, State Management, Inter-Module Synchronization, Radix UI Deadlock Prevention, Anti-Double Submit
- Library or platform: React 19, Next.js 16, Zustand, Radix UI, Better-SQLite3, Vitest
- Installed version: next 16.0.0, react 19.0.0, vitest 4.1.11
- Related files:
  - `apps/desktop/components/pages/protected-app-shell.tsx`
  - `apps/desktop/components/providers.tsx`
  - `apps/desktop/components/pages/invoice-editor.tsx`
  - `apps/desktop/components/pages/quote-editor.tsx`
  - `apps/desktop/components/pages/user-editor.tsx`
  - `apps/desktop/components/pages/invoices/InvoiceViews.tsx`
  - `apps/desktop/components/pages/quotes/QuoteViews.tsx`
  - `apps/desktop/components/pages/invoices/PaymentDialog.tsx`
  - `apps/desktop/components/features/credit-notes/CreateCreditNoteModal.tsx`
  - `apps/desktop/components/pages/services.tsx`
  - `apps/desktop/lib/services/QuoteService.ts`
  - `apps/desktop/lib/services/InvoiceService.ts`
  - `apps/desktop/app/actions/quote.actions.ts`
  - `apps/desktop/tests/unit/post-action-navigation-and-state.test.ts`

## Documentation Source

- Context7 source: `/radix-ui/primitives`, `/pmndrs/zustand`, `/vercel/next.js`
- Official fallback source: React 19 transition lifecycle, Radix UI Dialog & DropdownMenu dismissal coordination
- Date checked: 2026-11-05

## Context

In complex desktop workflows, business operations (creating an invoice, converting a quote, registering payments, emitting credit notes) cross multiple state boundaries. Previously, several vulnerabilities could manifest under heavy user interactions:
1. `editingId` leaked across navigation tabs because page changes didn't reset edit targets.
2. Radix UI dropdown unmounting transitions could lock pointer-events (`pointer-events: none` on `document.body`) when immediately replaced by modal overlays.
3. Rapid clicking or simultaneous shortcut key activations could trigger duplicate mutations before asynchronous `isSubmitting` React states committed.
4. Deleting or filtering items could leave the view on an empty, out-of-range page index.
5. Converting quotes or generating invoices required immediate, synchronized deduction of physical stock quantities in SQLite without requiring a manual page refresh.

## Decision

1. **Centralized Atomic Navigation (`navigateTo`)**:
   - `protected-app-shell.tsx` unifies view transitions into `navigateTo(page, options)`.
   - By default, `options.editingId` resets to `null` whenever navigating via sidebar, top navigation, or command palette, completely eradicating state leaks.
   - Dynamic editors (`InvoiceEditor`, `QuoteEditor`, `UserEditor`) are keyed with unique view/id compound keys to guarantee fresh component mount instances.

2. **Radix UI Pointer-Events Safety Net**:
   - `Providers.tsx` deploys a lightweight `MutationObserver` on `document.body` that immediately strips dangling `pointer-events: none` when no open Radix dialog/alertdialog overlay remains.
   - Dropdown action triggers (`InvoiceViews.tsx`, `QuoteViews.tsx`) defer modal openings via `setTimeout(..., 0)` so menu dismissal animations cleanly finalize before dialogs mount.

3. **Synchronous Mutation Locks (`submitLockRef`)**:
   - Form submission handlers across editors (`invoice-editor`, `quote-editor`, `user-editor`, `payment-dialog`, `create-credit-note-modal`, `services`) utilize synchronous `submitLockRef.current` mutexes, instantly rejecting concurrent event loop triggers.

4. **Multi-Module Inventory & Accounting Synchronizations**:
   - `QuoteService.convertToInvoice` transfers `serviceId` to `invoice_items` and records physical inventory movements (`INVOICE_DEDUCTION`).
   - `CreditNoteService` emits `CREDIT_NOTE_RESTOCK` to return credited quantities back to available inventory.
   - Store caches (`refreshStockData`, `invalidateLedgerCache`, `setInvoices`, `setQuotes`, `setCreditNotes`) are systematically invalidated across payment, credit note, and conversion actions.

5. **Safe Pagination Clamping**:
   - All listing views clamp their current page using `safePage = Math.min(currentPage, Math.max(1, totalPages))` and synchronize `currentPage` back within valid ranges via reactive effects.

## Consequences

- Zero UI deadlocks or frozen screens when chaining dropdown actions to modal dialogs.
- Zero state leakage between creating new documents and editing existing records.
- 100% synchronized inventory and ledger caches across quote conversions, payments, and credit note cancellations.
- Zero duplicate submissions from rapid multi-clicking.

## Alternatives Considered

- Allowing asynchronous `isSubmitting` alone: Rejeté car les microtâches React ne bloquent pas les clics concurrents dans le même tour d'événement.
- Polling du stock physique : Rejeté au profit de l'invalidation transactionnelle ciblée `refreshStockData(true)` et `invalidateLedgerCache()`.

## Risks

- *Risque* : Blocage d'une soumission si le verrou synchrone n'est pas libéré en cas d'exception.
- *Atténuation* : Tous les verrous `submitLockRef.current = false` sont strictement placés dans des blocs `finally`.

## Verification

- Command: `npx tsc --noEmit --project apps/desktop/tsconfig.json`
- Test: `npx vitest run apps/desktop/tests/unit/post-action-navigation-and-state.test.ts --config apps/desktop/vitest.config.ts`
- Decision Quality: `npm run quality:decisions`
