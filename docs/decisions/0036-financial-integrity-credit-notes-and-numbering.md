# ADR-0036: Intégrité Financière — Plafond Cumulé des Avoirs et Recalcul Canonique du Solde

## Status

Accepted

## Scope

- Area: Facturation, Avoirs (Credit Notes), Calculs Fiscaux XAF, Transitions de Statut, Numérotation Documentaire
- Library or platform: SQLite local, TypeScript, math-logic
- Installed version: better-sqlite3 12.10.0
- Related files:
  - `apps/desktop/lib/services/CreditNoteService.ts`
  - `apps/desktop/lib/api/invoice-logic.ts`
  - `apps/desktop/app/actions/invoice.actions.ts`
  - `apps/desktop/tests/unit/CreditNoteService.test.ts`
  - `packages/database/src/fiscal/index.ts`
  - `apps/desktop/lib/api/numbering.ts`

## Documentation Source

- Context7 source: `/wiselibs/better-sqlite3`
- Official fallback source: Normes Fiscales et Comptables OHADA / DGI Gabon
- Date checked: 2026-10-28

## Context

L'audit comptable et le diagnostic technique ont révélé deux failles critiques d'intégrité financière :
1. **Dépassement du montant de la facture par accumulation d'avoirs (D4)** : `CreditNoteService` comparait uniquement le total d'un avoir individuel au montant de la facture. L'émission de plusieurs avoirs partiels successifs pouvait dépasser le montant TTC initial sans blocage.
2. **Duplication du code d'annulation** : L'action serveur `invoice.actions.ts` (suppression de facture) contenait une copie en SQL brut du code de création d'avoir au lieu de déléguer à `CreditNoteService`.
3. **Statut de facture déconnecté des avoirs** : La fonction canonique `updateInvoiceStatus` calculait le reste à payer uniquement à partir des paiements (`totalPaid`), ignorant totalement les avoirs émis (`totalAvoirs`).
4. **Numérotation aléatoire non continue (D6)** : En cas de conflit, un suffixe hexadécimal aléatoire `-A3F9` était ajouté, violant l'obligation de continuité séquentielle de la numérotation fiscale.

## Decision

Nous appliquons les résolutions financières du Lot B du Plan Correctif :

1. **Plafond Cumulé Strict des Avoirs** :
   - Dans `CreditNoteService.createCreditNote`, calcul de `totalAlreadyCredited = SUM(total)` pour l'ensemble des avoirs actifs (non supprimés) rattachés à la facture.
   - Refus strict avec erreur 400 si `totalAlreadyCredited + computed.total > invoice.total`.
   - Transition automatique de la facture vers le statut `CANCELLED` dès que le cumul couvre l'intégralité du montant TTC (`totalAlreadyCredited + computed.total >= invoice.total`).

2. **Chemin Unique de Création d'Avoir** :
   - Suppression du SQL dupliqué dans `invoice.actions.ts` lors de l'annulation de facture, remplacé par l'appel centralisé à `CreditNoteService.createCreditNote`.

3. **Recalcul Canonique du Solde Facture (`updateInvoiceStatus`)** :
   - Formule : `reste = totalTTC - totalAvoirs - totalPaid`.
   - Si `totalAvoirs >= totalTTC` : `CANCELLED`.
   - Si `totalAvoirs + totalPaid >= totalTTC` et `totalPaid > 0` : `PAID`.
   - Si `totalAvoirs + totalPaid > 0` : `PARTIALLY_PAID`.
   - Si aucun paiement ni avoir : `UNPAID`.
   - Si un avoir est annulé (soft delete), la facture est automatiquement rouverte dans le statut approprié.

4. **Série Continue par Poste de Travail (D6)** :
   - Utilisation du code poste (`P1`, `P2`) pour préfixer la séquence (`FAC-P1-001/GM/2026`), garantissant la stricte continuité sans collision multi-postes.

## Alternatives Considered

- Refus total de tout avoir partiel : rejeté car les avoirs partiels (remise a posteriori, retour partiel de marchandise) sont une exigence comptable fondamentale.
- Mise à jour manuelle des statuts de facture dans chaque action : rejeté car source d'incohérences de solde ; `updateInvoiceStatus` doit rester la seule source de vérité.

## Risks

- Cas où un avoir partiel et un paiement dépassent conjointement le total TTC (trop-perçu).
- Mitigation : `updateInvoiceStatus` traite la facture comme soldée (`PAID`) et la comptabilité traite le trop-perçu par un remboursement dédié.

## Verification

- Command: `npx vitest run tests/unit/CreditNoteService.test.ts`
- Test: 3 tests unitaires validant le rejet en cas de dépassement cumulé, l'annulation automatique après solde, et la réouverture de la facture lors de la suppression d'un avoir.
