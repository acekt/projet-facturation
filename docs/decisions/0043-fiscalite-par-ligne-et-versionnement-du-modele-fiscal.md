# ADR-0043: Préparation de la Fiscalité par Ligne, Régimes DGI et Versionnement du Modèle Fiscal

## Status

Accepted

## Scope

- Area: Moteur fiscal, Modèle de données canonique, Calcul des taxes CEMAC / Gabon
- Library or platform: @workspace/database, facturier-desktop, web-hub
- Installed version: @workspace/database@1.0.0, facturier-desktop@1.0.0
- Related files:
  - `packages/database/src/fiscal/index.ts`
  - `packages/database/src/types/index.ts`
  - `packages/database/src/index.ts`
  - `apps/desktop/lib/math-logic.ts`
  - `apps/desktop/tests/unit/math-logic.test.ts`

## Documentation Source

- Context7 source: `/workspace/database`
- Official fallback source: Code Général des Impôts du Gabon (Loi de Finances, dispositions TVA, CSS et TPS), OHADA normes comptables CEMAC
- Date checked: 2026-10-28

## Context

L'audit architectural et la revue fiscale (problème D12 du diagnostic et lot L1 du plan curatif) ont identifié une limitation structurelle dans l'ancien calcul :
1. **Application uniforme de la cascade fiscale** : Le moteur historique `computeTotals` appliquait la même cascade (Net HT -> CSS 1% -> Base Taxable -> TPS 9.5% -> TVA 18%) indistinctement à toutes les lignes d'un document.
2. **Nécessité de ventiler par nature économique** : En fiscalité gabonaise, les opérations ne supportent pas toutes la même charge :
   - Les marchandises (biens corporels) sont soumises à la TVA (18%) et à la CSS (1%), mais sont légalement exemptées de la TPS (Taxe sur les Prestations de Services).
   - Les prestations de services peuvent être soumises à la TPS (9.5%) ou à la TVA selon le régime de l'assujetti.
   - Les opérations exonérées ou de santé/éducation sont exemptes de TVA/TPS.
3. **Condition stricte de validation comptable** : Le plan curatif stipule expressément que l'activation en production de la ventilation ligne à ligne ne peut intervenir qu'après validation écrite formelle du cabinet comptable afin d'éviter tout litige avec la DGI. Les documents existants doivent rester rigoureusement inchangés (principe d'immutabilité et de non-rétroactivité fiscale).

## Decision

1. **Introduction des types canoniques de régime fiscal** :
   - Déclaration du type `TaxRegime = 'GOODS' | 'SERVICES' | 'EXEMPT'` dans `packages/database/src/types/index.ts`.
   - Ajout du champ optionnel `taxRegime?: TaxRegime` dans les interfaces `IService`, `IQuoteItem`, `IInvoiceItem`, `ICreditNoteItem`.
   - Valeur par défaut lors de la reprise et de la rétrocompatibilité : `'SERVICES'`.
2. **Versionnement du modèle fiscal sur les en-têtes de documents** :
   - Ajout du champ optionnel `taxModelVersion?: number` dans `IQuote`, `IInvoice`, `ICreditNote`.
   - `taxModelVersion: 1` (ou `undefined`) correspond au moteur historique unifié `computeTotals` garantissant que les factures et devis passés ne dérivent jamais de leur total initial.
   - `taxModelVersion: 2` correspond au calcul ventilé multi-régime.
3. **Moteur mathématique pur multi-régime `computeTotalsByRegime`** :
   - Implémenté dans `packages/database/src/fiscal/index.ts`.
   - Calcule séparément les assiettes HT (`goodsHT`, `servicesHT`, `exemptHT`).
   - Répartit proportionnellement les remises globales au prorata des montants HT de chaque régime.
   - Applique la CSS (1%) sur le Net HT global.
   - Isole l'assiette taxable des marchandises (TVA sans TPS) de celle des services (TPS et TVA).
4. **Protocole de mise en production conditionnelle** :
   - Le moteur par défaut actif dans l'application reste `computeTotals` (`taxModelVersion: 1`) jusqu'à réception de la lettre de validation du cabinet comptable.
   - Aucune modification de schéma destructrice n'est effectuée sur les bases de données existantes.

## Risks

- **Risque de divergence des totaux lors de devis convertis en factures** : Mitigé par le fait que les devis et factures partagent le même `taxModelVersion` et que les calculs de conversion reportent le modèle de l'en-tête source.
- **Risque d'incohérence avec les états comptables antérieurs** : Éliminé par le gel des documents historiques sous le modèle version 1.

## Verification

- Tests unitaires complets ajoutés dans `apps/desktop/tests/unit/math-logic.test.ts` couvrant les 4 cas fondamentaux (marchandises seules, prestations seules, exonéré seul, panier mixte avec remise globale).
- Validation de typage TypeScript strict à l'échelle du monorepo via Turborepo (`npm run typecheck`).
- Validation des fiches de décision via `npm run quality:decisions`.
