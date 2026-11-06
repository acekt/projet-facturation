# ADR-0053: Audit Remediation Lots 1 à 4 — Backend, Stock, Fiscalité & Partage Multicanal

## Status

Accepted

## Scope

- Area: apps/desktop
- Library or platform: Electron, Next.js 16, Better-SQLite3, Vitest, TypeScript
- Installed version: Next.js 16.0.0, Electron 34.0.0, Better-SQLite3 11.8.1
- Related files:
  - `apps/desktop/lib/db/migrations/0006_item_service_link.ts`
  - `apps/desktop/lib/db/migrations/index.ts`
  - `apps/desktop/main/ipc.js`
  - `apps/desktop/preload.js`
  - `apps/desktop/types/electron.d.ts`
  - `apps/desktop/app/actions/share.actions.ts`
  - `apps/desktop/components/providers.tsx`
  - `apps/desktop/lib/sync/CloudSyncService.ts`
  - `apps/desktop/lib/validations.ts`
  - `apps/desktop/lib/repositories/StockRepository.ts`
  - `apps/desktop/lib/repositories/PaymentRepository.ts`
  - `apps/desktop/lib/repositories/LedgerRepository.ts`
  - `apps/desktop/lib/repositories/InvoiceRepository.ts`
  - `apps/desktop/lib/repositories/QuoteRepository.ts`
  - `apps/desktop/lib/services/InvoiceService.ts`
  - `apps/desktop/lib/services/CreditNoteService.ts`
  - `apps/desktop/lib/services/QuoteService.ts`
  - `apps/desktop/lib/services/ShareService.ts`
  - `apps/desktop/components/features/share/ShareDocumentModal.tsx`
  - `apps/desktop/components/features/common/CreationSuccessModal.tsx`
  - `apps/desktop/components/pages/invoices/InvoiceViews.tsx`
  - `apps/desktop/components/pages/quotes/QuoteViews.tsx`
  - `apps/desktop/app/page.tsx`
  - `apps/desktop/tests/unit/audit-remediation-lots-1-4.test.ts`

## Documentation Source

- Context7 source: Better-SQLite3, Electron security documentation, Next.js 16 Server Actions
- Official fallback source: https://www.electronjs.org/docs/latest/tutorial/security
- Date checked: 2026-11-04

## Context

L'audit approfondi du code issu des Sprints 1 à 11 a révélé des anomalies structurelles et régressions potentielles :
1. Sécurité IPC Electron : absence de handler `openExternal` filtrant les protocoles autorisés (WhatsApp / mailto), provoquant une absence de redirection ou des risques d'exécution de code malveillant.
2. Schéma SQL Audit : tentative d'insertion dans une colonne obsolète `entity` au lieu de `entityType` dans `share.actions.ts`.
3. Traçabilité Stock : rupture du lien produit/service entre les lignes de commande et le catalogue (`serviceId` absent dans `invoice_items` et `credit_note_items`), et écrasement des stocks lors de la modification d'un service.
4. Reste à charge : calcul du solde restant omettant les avoirs émis sur facture lors des paiements et des affichages clients.
5. Modal de succès de création : `<CreationSuccessModal />` non instanciée dans le rendu JSX de 5 pages majeures.

## Decision

1. Migration SQLite 0006 : ajout de `serviceId` avec clés étrangères et index sur `invoice_items`, `credit_note_items` et `quote_items`.
2. Sécurisation IPC Electron : exposition de `openExternal` avec validation stricte par expression régulière `^(https:\/\/(wa\.me|api\.whatsapp\.com)\/|mailto:)`.
3. Harmonisation Audit SQL : utilisation de `entityType` dans `share.actions.ts`.
4. Traçabilité de Stock complète :
   - Préservation des champs `trackStock`, `stockQuantity`, `minStockAlert`, `unit` dans `serviceUpdateSchema` et `service.actions.ts`.
   - Propagation de `serviceId` de bout en bout (UI -> DraftItem -> Server Actions -> Repositories).
   - Déduction de stock sur facture (`INVOICE_DEDUCTION`) et réintégration automatique lors de l'émission d'un avoir (`CREDIT_NOTE_RESTOCK`).
5. Intégrité Financière & Reste à payer :
   - Déduction systématique des avoirs (`totalTTC - totalAvoirs - totalPaid`) dans `createPayment`, `PaymentRepository` et `document-a4.tsx`.
   - Protection du Grand Livre : blocage de la suppression des écritures liées à une facture ou un paiement.
6. Partage Multicanal & UI :
   - Résolution automatique du téléphone client pour WhatsApp dans `ShareDocumentModal`.
   - Calcul exact du Net HT et exclusion de la mention 'Reste à payer' sur les devis dans `ShareService`.
   - Intégration du menu 'Partager' dans `InvoiceViews` et `QuoteViews`.
   - Câblage physique de `<CreationSuccessModal />` dans `user-editor.tsx`, `clients.tsx`, `services.tsx`, `invoice-editor.tsx` et `quote-editor.tsx`.

7. Next.js 16 Prerender & Dynamic Runtime :
   - Ajout de `await connection()` et `export const dynamic = 'force-dynamic'` dans `apps/desktop/app/page.tsx` pour empêcher le prérendu statique d'évaluer les APIs temporelles instables (`Date.now()` dans `getSession()`) et SQLite synchrone hors requête.

## Alternatives Considered

- *Gestion du lien de stock uniquement par le nom du service*: Rejeté car fragile lors du renommage d'un produit ou de variations mineures de saisie.
- *Ouverture de n'importe quelle URL externe via IPC*: Rejeté pour des raisons critiques de sécurité Electron et de surface d'attaque.

## Risks

- *Les colonnes locales `serviceId` font échouer la synchronisation Supabase*:
  - *Mitigation*: Ajout de `serviceId` et `service_id` dans `LOCAL_ONLY_COLUMNS` de `CloudSyncService.ts`.

## Verification

- Command: `npx tsc --noEmit --project apps/desktop/tsconfig.json` (0 erreur)
- Test: `npm run test --workspace=facturier-desktop -- tests/unit/audit-remediation-lots-1-4.test.ts` (10/10 tests passés)
- Manual check: `npm run quality:decisions` validé.
