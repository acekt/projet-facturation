# ADR-0055: Optimisation des Menus Contextuels (3 Points) selon la Psychologie du Design

## Status

Accepted

## Scope

- Area: apps/desktop
- Library or platform: React 19, Next.js 16, Lucide React, Radix UI, Tailwind CSS
- Installed version: Next.js 16.0.0, Electron 34.0.0, Lucide-React 0.474.0
- Related files:
  - `apps/desktop/components/pages/invoices/InvoiceViews.tsx`
  - `apps/desktop/components/pages/quotes/QuoteViews.tsx`

## Documentation Source

- Context7 source: Principes de Gestalt (regroupement & proximité), Loi de Hick-Hyman (temps de décision), Nielsen Norman Group (Menu Design & Visual Noise)
- Official fallback source: Apple Human Interface Guidelines (Contextual Menus)
- Date checked: 2026-11-04

## Context

L'inspection visuelle du menu contextuel (3 points) des factures a révélé un contraste frappant avec la propreté du menu des clients :
1. **Effet « Arbre de Noël » (Color Fatigue)** : profusion de couleurs vives disparates (texte vert vif pour les règlements, orange vif pour l'avoir et l'annulation, bleu et rouge), créant une surcharge cognitive et désensibilisant l'utilisateur aux véritables actions de danger.
2. **Absence de segmentation (Loi de Hick-Hyman)** : 8 actions empilées linéairement sans regroupement logique, forçant une lecture exhaustive.
3. **Troncature et multi-lignes** : l'intitulé « Émettre un avoir / remboursement » se brisait sur 2 lignes dans un conteneur trop étroit (`w-52`), rompant le rythme de lecture.
4. **Collision sémantique d'icônes** : réutilisation de la même icône `RefreshCcw` pour deux actions antagonistes (« Émettre un avoir » et « Annuler »).

## Decision

1. **Hiérarchisation en 3 Groupes Cognitifs Étanches (Loi de Gestalt)** :
   - **Groupe 1 : Consultation & Diffusion** (`Voir les détails`, `Télécharger PDF`, `Imprimer`, `Partager`).
   - **Groupe 2 : Opérations Métier & Règlements** (`Modifier la facture`, `Enregistrer un règlement`, `Émettre un avoir`).
   - **Groupe 3 : Actions Sensibles & Destructives** (`Annuler la facture`, `Supprimer`).
2. **Neutralisation Typographique & Épuration des Couleurs** :
   - Tous les textes d'actions positives ou neutres adoptent la couleur standard `text-foreground`.
   - Seule l'action de suppression irréversible conserve `text-destructive`.
   - Les icônes portent de discrètes touches sémantiques (icône `CreditCard` vert doux, icône `Ban` ambre, icône `Eye` primaire).
3. **Concision des Libellés & Calibrage Spatial** :
   - Raccourcissement de « Émettre un avoir / remboursement » en « Émettre un avoir » (monoligne net).
   - Attribution d'une icône dédiée `Ban` pour « Annuler la facture ».
   - Élargissement du conteneur à `w-56` avec séparateurs discrets `<DropdownMenuSeparator className="my-1 bg-border/60" />` et bordure adoucie `rounded-xl shadow-lg`.
4. **Harmonisation transverse** :
   - Application de la même structure sur les devis (`QuoteViews.tsx`).

## Alternatives Considered

- *Conserver la coloration vive sur chaque ligne de texte*: Rejeté car cela viole les normes UI/UX de sobriété des logiciels professionnels ERP et distrait l'utilisateur.
- *Sous-menus en cascade*: Rejeté pour les menus contextuels de tableau car ils augmentent le nombre de clics et le risque d'erreur motrice (Loi de Fitts).

## Risks

- *Habitude utilisateur des couleurs précédentes*:
  - *Mitigation*: La disposition en 3 blocs avec séparateurs clairs rend la localisation des actions immédiate et beaucoup plus rapide.

## Verification

- Command: `npx tsc --noEmit --project apps/desktop/tsconfig.json` (0 erreur).
- Test: `npm run test --workspace=facturier-desktop -- tests/unit/updateInvoiceStatus.test.ts tests/unit/share-document.test.ts tests/unit/audit-remediation-lots-1-4.test.ts` (41/41 tests passés).
- Quality: `npm run quality:decisions` (55 fiches valides).

