# 🚨 DEEP AUDIT REPORT 🚨

Ce rapport met en évidence les failles de qualité, les anti-patterns et les risques d'architecture.
Il a été généré via une analyse approfondie et sans concession du code source.

## 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)
### Utilisation de `any` ou assimilé

- **Fichier**: `app/api/credit-notes/route.ts`, Ligne 92
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `Error | unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `app/api/invoices/route.ts`, Ligne 74
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `Error | unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `app/api/quotes/[id]/route.ts`, Ligne 132
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const updateQuoteTx = db.transaction((quoteItems: any[]) => {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `app/api/quotes/convert/route.ts`, Ligne 49
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `Error | unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `app/api/quotes/route.ts`, Ligne 116
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const insertQuote = db.transaction((quoteItems: any[]) => {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `app/api/settings/route.ts`, Ligne 102
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (dbError: any) {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `app/api/settings/route.ts`, Ligne 119
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `Error | unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `app/api/setup/route.ts`, Ligne 99
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (txError: any) {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `app/api/users/route.ts`, Ligne 103
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `Error | unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `app/api/users/route.ts`, Ligne 124
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `Error | unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `app/page.tsx`, Ligne 25
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as any`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `components/fullscreen-document-viewer.tsx`, Ligne 142
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const docNumber = (docProps.data as any)?.number ?? 'document'`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `components/fullscreen-document-viewer.tsx`, Ligne 178
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`?? `${docProps.type === 'facture' ? 'Facture' : docProps.type === 'devis' ? 'Devis' : 'Avoir'} — ${(docProps.data as any).number ?? ''}``)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `components/pages/credit-notes.tsx`, Ligne 111
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const rows = creditNotes.map(c => [c.number, c.clientName, c.total || (c as any).amount || 0, c.date, c.reason || '']);`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `components/pages/invoice-editor.tsx`, Ligne 732
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`items: items as any,`)
  - **Excellence**: Remplacer par une interface stricte (ex: `InvoiceItem[] | QuoteItem[]`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `components/pages/payments.tsx`, Ligne 192
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const getPaymentStatusInfo = (invoice: any) => {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `components/pages/quote-editor.tsx`, Ligne 790
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`items: items as any,`)
  - **Excellence**: Remplacer par une interface stricte (ex: `InvoiceItem[] | QuoteItem[]`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `components/pages/quote-editor.tsx`, Ligne 801
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} as any`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `components/pages/quotes.tsx`, Ligne 208
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `Error | unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `components/pages/quotes.tsx`, Ligne 331
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`variant={getQuoteStatusVariant(quote.status as any)}`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `components/pages/quotes.tsx`, Ligne 465
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`quote.status as any,`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `components/pages/quotes.tsx`, Ligne 613
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`variant={getQuoteStatusVariant(quote.status as any)}`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `components/pdf-document.tsx`, Ligne 310
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`<Text>Objet: {('notes' in document ? (document as any).notes : null) || "Prestations de services"}</Text>`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `components/pdf-document.tsx`, Ligne 343
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`<Text style={styles.totalVal}>{formatCurrencyPDF('discount' in document ? (document as any).discount : 0)}</Text>`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `generate_report.js`, Ligne 30
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`*   **Problème:** \`Map<string, any>\` pour le statement cache, et \`fatalErr: any\`.`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `generate_report.js`, Ligne 42
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`*   **Problème:** \`initialUser: any\``)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `hooks/use-quotes.ts`, Ligne 44
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `Error | unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `hooks/use-quotes.ts`, Ligne 81
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `Error | unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `lib/db.ts`, Ligne 125
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (fatalErr: any) {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `lib/db.ts`, Ligne 406
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (schemaErr: any) {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `lib/repositories/UserRepository.ts`, Ligne 38
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const values: any[] = [];`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `lib/services/ExportService.ts`, Ligne 291
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`(q as any).validUntil ? formatDate((q as any).validUntil) : "—",`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `lib/services/ExportService.ts`, Ligne 292
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`(q as any).subject ?? "—",`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `lib/services/InvoiceService.ts`, Ligne 16
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`createInvoice(data: any, userId: string, role: string) {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `patch_shell_import2.js`, Ligne 13
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`'initialUser: { id: string; name: string; role: "admin" | "user"; [key: string]: any }'`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/e2e/api-resilience.spec.ts`, Ligne 13
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`async function loginAsUser(page: any) {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/an6-credit-notes.test.ts`, Ligne 53
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`let invoice = testDb.prepare('SELECT * FROM invoices WHERE id = ?').get('inv-1') as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/an6-credit-notes.test.ts`, Ligne 72
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`invoice = testDb.prepare('SELECT * FROM invoices WHERE id = ?').get('inv-1') as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/an6-credit-notes.test.ts`, Ligne 84
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const cnRecord = testDb.prepare('SELECT * FROM credit_notes WHERE id = ?').get(creditNoteId) as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/an6-credit-notes.test.ts`, Ligne 91
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`invoice = testDb.prepare('SELECT * FROM invoices WHERE id = ?').get('inv-1') as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/batch-inserts.test.ts`, Ligne 35
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const insertQuoteTx = db.transaction((quoteItems: any[]) => {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/batch-inserts.test.ts`, Ligne 75
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const insertInvoiceTx = db.transaction((invoiceItems: any[]) => {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/contract-invoices.test.ts`, Ligne 149
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const itemsSum = invoice.items.reduce((sum: number, item: any) => sum + item.total, 0);`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/financial-flow.test.ts`, Ligne 87
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const dbQuote = testDb.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId) as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/financial-flow.test.ts`, Ligne 106
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const dbQuoteInvoiced = testDb.prepare('SELECT status FROM quotes WHERE id = ?').get(quoteId) as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/financial-flow.test.ts`, Ligne 110
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const dbInvoice = testDb.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/financial-flow.test.ts`, Ligne 138
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const dbInvoicePaid = testDb.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/financial-flow.test.ts`, Ligne 142
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const totalPayments = testDb.prepare('SELECT SUM(amount) as total FROM payments WHERE invoiceId = ? AND deletedAt IS NULL').get(invoiceId) as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/financial-flow.test.ts`, Ligne 164
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const dbDeletedPayment = testDb.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/financial-flow.test.ts`, Ligne 168
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const dbInvoiceReverted = testDb.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/phase2-services.test.ts`, Ligne 121
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const dbRow = testDb.prepare('SELECT * FROM services WHERE id = ?').get(data.id) as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/phase2-services.test.ts`, Ligne 291
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const rawDbRow = testDb.prepare('SELECT id, name, deletedAt FROM services WHERE id = ?').get(service.id) as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/phase2-services.test.ts`, Ligne 306
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`expect(listData.some((s: any) => s.id === service.id)).toBe(false);`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/phase3-clients.test.ts`, Ligne 113
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const dbRow = testDb.prepare('SELECT * FROM clients WHERE id = ?').get(data.id) as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/phase3-clients.test.ts`, Ligne 201
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`expect(listA.some((c: any) => c.id === clientB.id)).toBe(true);`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/phase3-clients.test.ts`, Ligne 288
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const rawRow = testDb.prepare('SELECT id, name, deletedAt FROM clients WHERE id = ?').get(client.id) as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/phase6-invoices.test.ts`, Ligne 160
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const createdInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(data.invoiceId) as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/phase6-invoices.test.ts`, Ligne 239
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const rawRecord = db.prepare('SELECT * FROM invoices WHERE id = ?').get('fac-soft-delete') as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/phase6-invoices.test.ts`, Ligne 306
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`status: 'pending' as any,`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/phase6-invoices.test.ts`, Ligne 311
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/phase6-invoices.test.ts`, Ligne 317
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`store.updateInvoice('fac-store-1', { status: 'paid' as any });`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/phase7-payments.test.ts`, Ligne 255
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const savedPayment = db.prepare('SELECT * FROM payments WHERE id = ?').get(data.id) as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/phase7-payments.test.ts`, Ligne 357
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/phase9-audit-settings.test.ts`, Ligne 95
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const logEntry = db.prepare('SELECT * FROM audit_logs WHERE entityId = ?').get('client-trace-1') as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/phase9-audit-settings.test.ts`, Ligne 216
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const stored = db.prepare('SELECT nif, rccm FROM settings WHERE id = 1').get() as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/protected-root-route.test.ts`, Ligne 9
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`(err as any).digest = `NEXT_REDIRECT;replace;${url};307;`;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/protected-root-route.test.ts`, Ligne 25
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (err: any) {`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/setup-onboarding.test.ts`, Ligne 71
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const userInDb = testDb.prepare('SELECT * FROM users WHERE email = ?').get('admin@facturier.ga') as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/setup-onboarding.test.ts`, Ligne 76
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const settingsInDb = testDb.prepare('SELECT * FROM settings WHERE id = 1').get() as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `tests/integration/setup-onboarding.test.ts`, Ligne 87
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const auditLog = testDb.prepare("SELECT * FROM audit_logs WHERE details LIKE '%FIRST_RUN_SETUP%'").get() as any;`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

- **Fichier**: `types/electron.d.ts`, Ligne 3
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`// This eliminates all (window as any).electron unsafe casts in components.`)
  - **Excellence**: Remplacer par une interface stricte (ex: `unknown`) ou `unknown` si le type est incertain au runtime, avec des gardes de type.

## 2. LOGIQUE REACT ET ANTI-PATTERNS UI

### Anti-patterns hooks (dépendances manquantes ou dangereuses)

- **Fichier**: `components/pages/invoice-editor.tsx`, Ligne 137
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
    ```tsx
    try {
      fetch(`/api/invoices/${editingId}`, { signal: controller.signal })
    } catch (error) {
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/invoice-editor.tsx`, Ligne 292
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
    ```tsx
    try {
      const newInvoices = await fetch("/api/invoices").then((res) =>
    } catch (error) {
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/invoices.tsx`, Ligne 172
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
    ```tsx
    try {
      const updatedInvoices = await fetch('/api/invoices').then(res => res.json());
    } catch (error) {
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/invoices.tsx`, Ligne 174
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
    ```tsx
    try {
      const updatedQuotes = await fetch('/api/quotes').then(res => res.json());
    } catch (error) {
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/invoices.tsx`, Ligne 176
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
    ```tsx
    try {
      const updatedNotes = await fetch('/api/credit-notes').then(res => res.json());
    } catch (error) {
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/invoices.tsx`, Ligne 274
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
    ```tsx
    try {
      const updatedInvoices = await fetch('/api/invoices').then(res => res.json());
    } catch (error) {
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/invoices.tsx`, Ligne 276
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
    ```tsx
    try {
      const updatedPayments = await fetch('/api/payments').then(res => res.json());
    } catch (error) {
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/quote-editor.tsx`, Ligne 158
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
    ```tsx
    try {
      fetch(`/api/quotes/${editingId}`, { signal: controller.signal })
    } catch (error) {
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/quote-editor.tsx`, Ligne 323
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
    ```tsx
    try {
      const newQuotes = await fetch("/api/quotes").then((res) => res.json());
    } catch (error) {
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/quotes.tsx`, Ligne 202
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
    ```tsx
    try {
      fetch("/api/quotes").then((res) => res.json()),
    } catch (error) {
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/quotes.tsx`, Ligne 203
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
    ```tsx
    try {
      fetch("/api/invoices").then((res) => res.json()),
    } catch (error) {
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/user-editor.tsx`, Ligne 141
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
    ```tsx
    try {
      const res = await fetch(url, {
    } catch (error) {
      toast.error("Erreur réseau");
    }
    ```

## 3. ARCHITECTURE ELECTRON ET IPC

### Fuites de mémoire dans l'IPC

Aucune fuite de mémoire IPC évidente détectée.

## 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

### Requêtes N+1 et boucles

- **Fichier**: `app/api/dashboard/metrics/route.ts`, Ligne 71
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 77) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
    ```typescript
    // Exemple d'optimisation
    const insertStmt = db.prepare('INSERT INTO table_name (...) VALUES (...)');
    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(...);
       }
    });
    executeTx(items);
    ```

- **Fichier**: `app/api/dashboard/metrics/route.ts`, Ligne 73
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 77) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
    ```typescript
    // Exemple d'optimisation
    const insertStmt = db.prepare('INSERT INTO table_name (...) VALUES (...)');
    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(...);
       }
    });
    executeTx(items);
    ```

- **Fichier**: `app/api/dashboard/metrics/route.ts`, Ligne 83
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 87) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
    ```typescript
    // Exemple d'optimisation
    const insertStmt = db.prepare('INSERT INTO table_name (...) VALUES (...)');
    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(...);
       }
    });
    executeTx(items);
    ```

- **Fichier**: `app/api/dashboard/metrics/route.ts`, Ligne 85
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 87) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
    ```typescript
    // Exemple d'optimisation
    const insertStmt = db.prepare('INSERT INTO table_name (...) VALUES (...)');
    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(...);
       }
    });
    executeTx(items);
    ```

- **Fichier**: `app/api/dashboard/metrics/route.ts`, Ligne 98
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 106) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
    ```typescript
    // Exemple d'optimisation
    const insertStmt = db.prepare('INSERT INTO table_name (...) VALUES (...)');
    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(...);
       }
    });
    executeTx(items);
    ```

- **Fichier**: `app/api/dashboard/metrics/route.ts`, Ligne 105
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 106) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
    ```typescript
    // Exemple d'optimisation
    const insertStmt = db.prepare('INSERT INTO table_name (...) VALUES (...)');
    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(...);
       }
    });
    executeTx(items);
    ```

- **Fichier**: `app/api/invoices/[id]/route.ts`, Ligne 168
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 169) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
    ```typescript
    // Exemple d'optimisation
    const insertStmt = db.prepare('INSERT INTO table_name (...) VALUES (...)');
    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(...);
       }
    });
    executeTx(items);
    ```

- **Fichier**: `app/api/quotes/[id]/route.ts`, Ligne 167
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 168) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
    ```typescript
    // Exemple d'optimisation
    const insertStmt = db.prepare('INSERT INTO table_name (...) VALUES (...)');
    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(...);
       }
    });
    executeTx(items);
    ```

- **Fichier**: `app/api/quotes/duplicate/route.ts`, Ligne 113
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 114) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
    ```typescript
    // Exemple d'optimisation
    const insertStmt = db.prepare('INSERT INTO table_name (...) VALUES (...)');
    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(...);
       }
    });
    executeTx(items);
    ```

- **Fichier**: `app/api/quotes/route.ts`, Ligne 151
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 152) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
    ```typescript
    // Exemple d'optimisation
    const insertStmt = db.prepare('INSERT INTO table_name (...) VALUES (...)');
    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(...);
       }
    });
    executeTx(items);
    ```

- **Fichier**: `app/api/settings/route.ts`, Ligne 86
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 92) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
    ```typescript
    // Exemple d'optimisation
    const insertStmt = db.prepare('INSERT INTO table_name (...) VALUES (...)');
    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(...);
       }
    });
    executeTx(items);
    ```

- **Fichier**: `lib/repositories/UserRepository.ts`, Ligne 40
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 48) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
    ```typescript
    // Exemple d'optimisation
    const insertStmt = db.prepare('INSERT INTO table_name (...) VALUES (...)');
    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(...);
       }
    });
    executeTx(items);
    ```

- **Fichier**: `lib/services/CreditNoteService.ts`, Ligne 81
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 82) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
    ```typescript
    // Exemple d'optimisation
    const insertStmt = db.prepare('INSERT INTO table_name (...) VALUES (...)');
    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(...);
       }
    });
    executeTx(items);
    ```

- **Fichier**: `lib/services/InvoiceService.ts`, Ligne 88
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 89) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
    ```typescript
    // Exemple d'optimisation
    const insertStmt = db.prepare('INSERT INTO table_name (...) VALUES (...)');
    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(...);
       }
    });
    executeTx(items);
    ```

- **Fichier**: `lib/services/QuoteService.ts`, Ligne 84
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 85) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
    ```typescript
    // Exemple d'optimisation
    const insertStmt = db.prepare('INSERT INTO table_name (...) VALUES (...)');
    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(...);
       }
    });
    executeTx(items);
    ```

