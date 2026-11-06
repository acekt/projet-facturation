# ADR-0059: In-App Multichannel Document Sharing (Direct SMTP PDF & Persistent WhatsApp Partition)

## Status

Accepted

## Scope

- Area: Desktop Multichannel Document Sharing, Electron IPC & SQLite Settings
- Library or platform: Electron, Next.js 16, Node.js TLS/SMTP, Better-SQLite3, React 19
- Installed version: Electron 34+, Next.js 16.4.3, React 19.2.0
- Related files:
  - `apps/desktop/lib/db/migrations/0008_smtp_settings.ts`
  - `apps/desktop/lib/services/ShareService.ts`
  - `apps/desktop/lib/services/SmtpMailer.ts`
  - `apps/desktop/app/actions/share.actions.ts`
  - `apps/desktop/components/features/share/ShareDocumentModal.tsx`
  - `apps/desktop/components/features/settings/CompanySettingsTab.tsx`
  - `apps/desktop/lib/electron-print.ts`
  - `apps/desktop/main/ipc.js`
  - `apps/desktop/preload.js`

## Documentation Source

- Context7 source: `/electron/electron` (`BrowserWindow` `partition: "persist:..."`, `webContents.printToPDF`, `clipboard`, `shell.showItemInFolder`), `/nodemailer/nodemailer` (`sendMail` with PDF buffer `attachments`, `verify`)
- Official fallback source: Electron Security & Session Partition Documentation, Node.js `tls`/`net` RFC 5321 / MIME RFC 2045
- Date checked: 2026-11-05

## Context

Previously, `ShareDocumentModal.tsx` suffered from several logical and ergonomic limitations:
1. It shared a single `recipient` state between WhatsApp and Email, causing client email addresses (`relations.entreprises@bgfi.com`) to populate the WhatsApp phone field.
2. It relied on `mailto:` links (which cannot attach generated A4 PDFs automatically) and external browser redirects.
3. WhatsApp formatting markers (`*bold*`, `_italic_`) leaked into Email bodies, and French grammatical gender agreement was inaccurate (`"Facture ... émis"` instead of `"Facture ... émise"`).
4. Opening `ShareDocumentModal` from list views (`InvoiceViews`, `QuoteViews`, `CreditNoteViews`) had no mounted `<DocumentA4 />` in the DOM to generate the PDF buffer.

## Decision

1. **Strict Separation of Contact Channels & Auto-Sync (`ShareDocumentModal.tsx`, `ShareService.ts`)**:
   - Separated `phone` and `email` states, resolving the client from the Zustand store (`clients`) by `id`, normalized `name`, or `email`.
   - Enforced strict phone validation (`ShareService.isValidWhatsAppPhone`) rejecting any `@` or alphabetic characters and requiring at least 8 valid digits.
   - Automatically updates the client's record (`updateClient`) when the operator enters or modifies a phone number or email in the share modal.
2. **Channel-Specific Formatting & Grammar (`ShareService.ts`)**:
   - Added `channel: "whatsapp" | "email"` to `ShareService.generateDocumentMessage`, stripping `*` and `_` for email text while generating a structured HTML email template (`generateDocumentEmailHtml`).
   - Enforced feminine agreement (`"Facture N° ... émise par ..."`) and masculine agreement (`"Devis N° ... émis par ..."`, `"Avoir N° ... émis par ..."`), and filtered out zero-amount taxes.
3. **Autonomous Off-Screen A4 PDF Rendering & In-App Delivery (`ipc.js`, `SmtpMailer.ts`, `share.actions.ts`)**:
   - Mounted an off-screen `<DocumentA4 />` inside `ShareDocumentModal.tsx` coupled with `app:render-pdf-buffer` (`webContents.printToPDF`) to produce a Base64 A4 PDF and save a local copy in `Documents/Facturier/Partages`.
   - Added migration `0008_smtp_settings` (`smtpHost`, `smtpPort`, `smtpUser`, `smtpPass`, `smtpSecure`) and `sendDocumentEmailInAppAction` to send emails with the A4 PDF attached directly from the app, with an inline quick-setup/fallback banner when SMTP is unconfigured.
   - Added `app:open-whatsapp-in-app` opening a dedicated child `BrowserWindow` with `partition: "persist:facturier-whatsapp"`, copying the message to the clipboard, and revealing the generated PDF for instant drag-and-drop.

## Alternatives Considered

- Rely on `mailto:` URLs for email delivery: Rejected because `mailto:` does not support automatic file attachments or HTML tables.
- Open WhatsApp links in the default OS browser: Rejected because it forces context switching outside the desktop app.

## Risks

- Unconfigured SMTP server on first use: Mitigated by providing both a 1-click inline SMTP configuration form inside the modal and a 1-click fallback that saves the PDF, copies the formatted subject/body, and reveals the PDF in Windows Explorer.

## Verification

- Command: `npx tsc --noEmit --project apps/desktop/tsconfig.json` (0 errors)
- Test: `npx vitest run --config apps/desktop/vitest.config.ts tests/unit/share-document.test.ts tests/unit/audit-remediation-lots-1-4.test.ts tests/unit/desktop-phase1-correctif.test.ts` (27/27 passed)

