# ADR-0057: Intégrité et Cohérence du Processus d'Émission des Avoirs

## Status

Accepted

## Scope

- Area: apps/desktop
- Library or platform: React 19, Next.js 16, @workspace/database/fiscal, Better-SQLite3
- Installed version: Next.js 16.0.0, Electron 34.0.0
- Related files:
  - `apps/desktop/lib/services/QuoteService.ts`
  - `apps/desktop/lib/services/CreditNoteService.ts`
  - `apps/desktop/components/features/credit-notes/CreateCreditNoteModal.tsx`
  - `apps/desktop/components/features/credit-notes/CreditNoteFormBody.tsx`
  - `apps/desktop/lib/validations.ts`
  - `apps/desktop/lib/types/api.ts`

## Documentation Source

- Context7 source: Code Général des Impôts Gabon (Régimes fiscaux et règles d'émission des notes de crédit), Principes comptables OHADA (Imputation de créance vs Remboursement monétaire)
- Date checked: 2026-11-04

## Context

L'audit de la fonctionnalité « Émettre un avoir » suite au cas constaté sur la facture `FAC-003/GM/2026` a mis en lumière 7 incohérences et bugs critiques :
1. **Lignes de devis supprimées importées dans la facture** : `QuoteService.convertToInvoice` exécutait `SELECT * FROM quote_items WHERE quoteId = ?` sans filtrer `deletedAt IS NULL`, provoquant la duplication des lignes révisées d'un devis dans la facture finale.
2. **Formulaire d'avoir bloqué d'office en dépassement de plafond** : `CreateCreditNoteModal` pré-remplissait bêtement toutes les lignes de la facture sans vérifier si leur total cumulé dépassait le plafond d'avoir disponible restant (`maxRefundableTtc`), affichant immédiatement une erreur bloquante sans assistance.
3. **Déconnexion fiscale entre facture et avoir** : Le calcul des taxes de l'avoir utilisait les taux globaux de `settings` au lieu d'hériter fidèlement des taux effectifs appliqués sur la facture (TVA exonérée ou 18%, assujettissement TPS 9.5%, CSS 1%).
4. **Statut de facture non mis à jour lors d'avoirs partiels** : `CreditNoteService` ne mettait à jour le statut de la facture vers `cancelled` que pour les avoirs totaux ($\ge 100\%$), omettant d'appeler `updateInvoiceStatus` pour les avoirs partiels (statut `PARTIALLY_PAID`).
5. **Rupture de la traçabilité des stocks** : Le champ `serviceId` n'était pas propagé depuis les lignes de facture vers la requête d'avoir, rendant impossible la réintégration automatique du stock (`CREDIT_NOTE_RESTOCK`).
6. **Inclusion de factures inéligibles** : Les factures déjà créditées à 100% ou les brouillons (`draft`) apparaissaient dans le sélecteur.

## Decision

1. **Filtrage Strict `deletedAt` dans `QuoteService`** :
   - Ajout systématique de `AND (deletedAt IS NULL OR deletedAt = '')` dans `convertToInvoice` et `duplicateQuote`.
2. **Héritage Fiscal Automatique de la Facture d'Origine** :
   - `activeRates` et `CreditNoteService` dérivent directement leurs taux effectifs de la facture (`invoice.tvaAmount > 0`, `invoice.tpsAmount > 0`, `invoice.cssAmount > 0`).
3. **Actions Rapides d'Assistance & Protection contre le Dépassement** :
   - Si les lignes brutes dépassent le solde restant disponible à l'ouverture, le formulaire calibre automatiquement la ligne d'avoir sur le solde restant exact.
   - Ajout des boutons « Solde restant » (ajustement mathématique automatique du HT pour atteindre exactement le plafond TTC) et « Lignes d'origine ».
   - Bouton de secours inline « Ajuster au plafond » dès qu'un dépassement survient.
4. **Recalcul Canonique du Statut de Facture** :
   - Appel systématique de `updateInvoiceStatus(invoice.id, targetTenantId)` lors de la création d'un avoir, gérant fluidement les transitions vers `PARTIALLY_PAID` et `CANCELLED`.
5. **Préservation du `serviceId` pour le Restockage** :
   - Extension de `CreditLineDraft`, `creditNoteItemSchema` et `CreditNoteCreateRequest` avec `serviceId`.
6. **Filtrage Préventif des Factures Éligibles** :
   - Exclusion des factures annulées, brouillons, ou dont le solde restant est nul.

## Alternatives Considered

- *Interdire la modification des lignes d'un avoir et forcer uniquement un montant global* : Rejeté car les normes DGI et OHADA imposent le détail des prestations ou marchandises faisant l'objet de la note de crédit.

## Risks

- Risk: Discordance de quelques centimes liée aux arrondis de cascade fiscale lors du calcul inverse HT $\rightarrow$ TTC.
- Mitigation: Algorithme d'ajustement itératif dans `getHTForTargetTTC` garantissant que le TTC calculé ne dépasse jamais le plafond d'un seul franc CFA.

## Verification

- Command: `npx tsc --noEmit --project apps/desktop/tsconfig.json`
- Test: `npm run test --workspace=facturier-desktop -- tests/unit/updateInvoiceStatus.test.ts`
- Manual check: Test du formulaire d'émission d'avoir sur une facture avec plafond partiel et vérification du bouton « Solde restant ».

