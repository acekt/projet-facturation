# ADR-0058: Creation Success Modal Standardization Across Commercial Documents

## Status

Accepted

## Scope

- Area: Desktop Frontend UX & Commercial Document Feedback Loops
- Library or platform: React 19, Tailwind CSS, Radix UI Dialog, Lucide Icons
- Installed version: React 19, Lucide React 1.16+
- Related files:
  - `apps/desktop/components/features/common/CreationSuccessModal.tsx`
  - `apps/desktop/components/pages/clients.tsx`
  - `apps/desktop/components/pages/services.tsx`
  - `apps/desktop/components/pages/invoice-editor.tsx`
  - `apps/desktop/components/pages/quote-editor.tsx`
  - `apps/desktop/components/pages/quotes.tsx`
  - `apps/desktop/components/features/credit-notes/CreateCreditNoteModal.tsx`
  - `apps/desktop/components/pages/invoices.tsx`
  - `apps/desktop/components/pages/credit-notes.tsx`

## Documentation Source

- Context7 source: `/shadcn-ui/ui/dialog`
- Official fallback source: Radix UI Dialog & Tailwind CSS documentation
- Date checked: 2026-11-04

## Context

Previously, feedback after creating entities lacked visual cohesion across modules:
1. Clients and Services used the compact and standardized `CreationSuccessModal` (`sm:max-w-md`, centered checkmark, clean metadata card, explicit close action).
2. Quotes and Invoices inside editors displayed simplified summaries without key business dates or monospace badge formatting.
3. Converting a quote into an invoice (`quotes.tsx`) only displayed a fleeting toast without revealing the generated invoice number or offering an instant preview.
4. Credit Note emission (`CreateCreditNoteModal.tsx`) used an isolated `CreditNoteSuccessView` embedded in an oversized `max-w-2xl` modal window without preview linkage.

## Decision

We standardized all entity and document creation success feedback on the reusable `CreationSuccessModal` pattern:
1. **Visual Standard**:
   - Centered `sm:max-w-md` dialog overlay with dark mode support (`dark:text-emerald-400`).
   - Standardized status icon: Emerald checkmark within a circular background badge.
   - Structured metadata panel (`bg-secondary/40 border border-border rounded-xl p-4`) with top-border highlight for monetary totals (`isAmount: true`, tabular numbers).
2. **Document Editors (Quotes & Invoices)**:
   - Full commercial context displayed: Monospaced reference code, client name, issue date, validity/due date, and bold TTC total.
   - Dual actions: "Fermer" (returns to list safely) and "Aperçu" (launches `FullScreenDocumentViewer`).
3. **Quote Conversion**:
   - Converted quotes now open `CreationSuccessModal` showcasing the generated invoice number, source quote, client, and TTC amount, with direct 1-click preview.
4. **Credit Notes**:
   - Deprecated separate oversized view in favor of `CreationSuccessModal` with monospace credit note reference, original invoice, client, TTC refund, remaining invoice balance, and direct full-screen preview.

## Alternatives Considered

- Keep distinct custom modals per entity: Rejected because it breaks design consistency and increases UI maintenance burden.
- Rely solely on toast notifications: Rejected because commercial documents (invoices, quotes, credit notes) require instant verification of generated reference codes and immediate print/preview workflows.

## Risks

- Dialog stacking when previewing: Mitigated by cleanly closing the success dialog upon triggering document preview.
- Type inconsistencies: Mitigated by rigorous TypeScript typing and validating all parameters across callers.

## Verification

- Command: `npx tsc --noEmit --project apps/desktop/tsconfig.json` (0 errors)
- Test: `npm run test --workspace=facturier-desktop -- tests/unit/CreditNoteService.test.ts tests/unit/module3-correctif.test.ts`
- Manual check: Verify creation workflow for Clients, Services, Invoices, Quotes, and Credit Notes.

