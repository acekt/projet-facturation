# ADR-0056: Transparence Fiscale Complète et Fidélité des Taxes (Norme DGI Gabon & OHADA)

## Status

Accepted

## Scope

- Area: apps/desktop
- Library or platform: React 19, Next.js 16, @workspace/database/fiscal, Tailwind CSS
- Installed version: Next.js 16.0.0, Electron 34.0.0
- Related files:
  - `apps/desktop/components/pages/invoices/InvoiceDetailsDialog.tsx`
  - `apps/desktop/components/pages/quotes/QuoteDetailsDialog.tsx`
  - `apps/desktop/components/features/credit-notes/CreditNoteDetailsDialog.tsx`
  - `apps/desktop/components/features/credit-notes/CreditNoteFormBody.tsx`
  - `apps/desktop/components/features/credit-notes/CreateCreditNoteModal.tsx`
  - `apps/desktop/components/editor/FiscalSummaryCard.tsx`
  - `apps/desktop/components/features/document-a4/A4FiscalSummary.tsx`
  - `apps/desktop/components/pdf-document.tsx`
  - `apps/desktop/lib/services/ShareService.ts`
  - `apps/desktop/components/features/export/DataExportModal.tsx`

## Documentation Source

- Context7 source: Code Général des Impôts Gabon (DGI Gabon 2026), Normes OHADA de présentation des états financiers et facturation
- Date checked: 2026-11-04

## Context

L'audit de la gestion fiscale dans l'application a mis en évidence plusieurs anomalies majeures de transparence :
1. **Regroupement opaque des taxes** : dans les fiches détaillées des devis (`QuoteDetailsDialog`) et des avoirs (`CreditNoteDetailsDialog`), la TVA et la CSS étaient agglomérées sous un libellé commun « TVA & Taxes » ou « TVA (18%) & CSS (1%) », masquant le montant exact de chaque taxe perçue ou déduite.
2. **Omission complète de la TPS** : la Taxe sur les Prestations de Services (TPS 9.5%) était purement ignorée dans l'affichage des détails des devis et des avoirs.
3. **Absence de la TVA dans le formulaire d'avoir** : dans `CreditNoteFormBody.tsx`, la ligne de TVA n'était même pas restituée dans le récapitulatif lors de l'émission d'un avoir, alors que le moteur fiscal calculait bien `tvaAmount`.
4. **Affichage trompeur de taxes à 0 FCFA** : dans `FiscalSummaryCard.tsx`, une ligne « TPS (9.5%): 0 FCFA » s'affichait systématiquement même lorsque l'entreprise n'était pas assujettie à la TPS. De plus, une TVA nulle était affichée comme un simple « 0 FCFA » sans mentionner le statut légal « 0 FCFA (Exonéré) ».
5. **Absence de décomposition fiscale dans les exports comptables et partages** : les exports CSV et messages WhatsApp résumaient uniquement le TTC sans détailler la cascade (Brut HT, Remise, Net HT, CSS, TPS, TVA, Total TTC).

## Decision

1. **Décomposition Fiscale Explicite dans tous les Dialogs de Détails** :
   - Ajout d'une section dédiée « Décomposition Fiscale & Taxes (Norme DGI Gabon) » dans `InvoiceDetailsDialog`, `QuoteDetailsDialog`, et `CreditNoteDetailsDialog`.
   - Affichage distinct de chaque composant de la cascade :
     - Brut HT
     - Remise Commerciale (si applicable)
     - Net HT
     - CSS (1%) (conditionné à montant > 0)
     - TPS (9.5%) (conditionné à assujettissement / montant > 0)
     - TVA (18%) (ou mention explicite « 0 FCFA (Exonéré) » si nulle)
     - Total TTC
2. **Rétablissement de la TVA et alignement des taux dans les Avoirs** :
   - Mise à jour de `CreditNoteFormBodyProps` pour intégrer `tvaAmount` et `tvaRate`.
   - Affichage de la ligne TVA dans le formulaire d'émission d'avoir.
   - Sécurisation des taux par défaut dans `CreateCreditNoteModal` (`tvaRate ?? 18`, `cssRate ?? 1`, `tpsRate ?? 0`).
3. **Affichage Conditionnel et Précis dans l'Éditeur (`FiscalSummaryCard`)** :
   - Affichage de la TPS uniquement si `tpsAmount > 0`.
   - Mention « 0 FCFA (Exonéré) » lorsque la TVA est à 0.
4. **Conformité des Documents Officiels (A4 & PDF)** :
   - Dans `A4FiscalSummary.tsx` et `pdf-document.tsx`, la ligne TVA affiche explicitement « 0 FCFA (Exonéré) » lorsque le montant est nul, assurant la conformité aux contrôles fiscaux.
5. **Enrichissement Comptable des Exports et Partages** :
   - `ShareService` détaille désormais la fiscalité appliquée dans les messages WhatsApp / Email.
   - `DataExportModal` inclut toutes les colonnes fiscales (Brut HT, Remise, Net HT, CSS, TPS, TVA, TTC) dans les exports CSV destinés à la comptabilité.

## Alternatives Considered

- *Conserver un montant global de taxes* : Rejeté car non conforme aux exigences de l'administration fiscale gabonaise (DGI) et de l'OHADA imposant une traçabilité ligne par ligne de chaque impôt indirect perçu.

## Risks

- Risk: Surcharge visuelle de la synthèse si toutes les taxes sont affichées même avec un montant nul.
- Mitigation: Conditionner strictement l'affichage de la TPS et de la CSS à leur application réelle (`amount > 0`), et expliciter « 0 FCFA (Exonéré) » pour la TVA afin de lever toute ambiguïté légale.

## Verification

- Command: `npx tsc --noEmit --project apps/desktop/tsconfig.json`
- Test: `npm run test --workspace=facturier-desktop -- tests/unit/updateInvoiceStatus.test.ts`
- Manual check: Vérifier l'affichage de la décomposition fiscale dans `InvoiceDetailsDialog`, `QuoteDetailsDialog`, `CreditNoteDetailsDialog`, `CreditNoteFormBody`, `A4FiscalSummary` et l'export CSV.
