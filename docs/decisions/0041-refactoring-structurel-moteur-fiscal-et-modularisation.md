# ADR-0041: Refactoring Structurel, Moteur Fiscal Unique et Modularisation

## Status

Accepted

## Scope

- Area: Architecture logicielle, Moteur fiscal, Electron main process, Store Zustand, UI Components
- Library or platform: Electron 35, Next.js 16, Zustand 5, TypeScript 5.8
- Installed version: facturier-desktop@1.0.0, @workspace/database@1.0.0
- Related files:
  - `packages/database/src/fiscal/index.ts`
  - `apps/desktop/main.js` and `apps/desktop/main/*.js`
  - `apps/desktop/app/setup/setup-client.tsx` and `apps/desktop/app/setup/**`
  - `apps/desktop/lib/store.ts` and `apps/desktop/lib/store/**`
  - `apps/desktop/lib/logger.ts`
  - `apps/desktop/components/pages/clients.tsx` and `apps/desktop/components/pages/clients/**`
  - `apps/desktop/components/pages/services.tsx` and `apps/desktop/components/pages/services/**`
  - `apps/desktop/components/pages/invoices.tsx` and `apps/desktop/components/pages/invoices/**`
  - `apps/desktop/components/pages/quotes.tsx` and `apps/desktop/components/pages/quotes/**`
  - `apps/desktop/components/pages/invoice-editor.tsx`
  - `apps/desktop/components/pages/quote-editor.tsx`
  - `apps/desktop/components/editor/**`

## Documentation Source

- Context7 source: `/electron/electron`, `/pmndrs/zustand`, `/vercel/next.js`
- Official fallback source: Documentation officielle Electron (process model & IPC safety), Zustand documentation (slices pattern)
- Date checked: 2026-10-28

## Context

L'audit architectural et curatif du projet facturier a mis en évidence plusieurs dettes techniques et facteurs de fragilité (identifiés dans les plans curatifs P2, P5, P6, P7) :
1. **Dispersion du calcul fiscal (P2)** : Deux calculs parallèles existaient (`computeTotals` et `calculateFiscalCascade`) avec des arrondis potentiellement divergents sur les taux CEMAC/Gabon (CSS 1%, TPS 9.5%, TVA 18%).
2. **Processus principal Electron monolithique (P5)** : `apps/desktop/main.js` dépassait 1 340 lignes, agrégeant la gestion des ports, l'orchestration du serveur Next.js en `utilityProcess`, les IPCs, le cycle de vie de la fenêtre, les sauvegardes et l'auto-updater.
3. **Composants UI monolithiques géants** : `setup-client.tsx` (1 459 lignes), `clients.tsx` (1 052 lignes), `invoices.tsx` (842 lignes), `quote-editor.tsx` (819 lignes), `quotes.tsx` (780 lignes), `services.tsx` (769 lignes), et `invoice-editor.tsx` (764 lignes) concentraient formulaire, modales, tables, filtres et calculs en un seul bloc difficilement testable.
4. **Store Zustand monolithique** : `apps/desktop/lib/store.ts` (986 lignes) déclarait tous les états applicatifs dans un seul objet géant, risquant des collisions et des re-rendus globaux.
5. **Journalisation et sécurité (P6)** : Présence d'appels directs à `console.*` risquant de faire fuiter des informations d'authentification ou des identifiants dans les sorties standard.
6. **Valeurs factices et placeholders (P7)** : Présence de valeurs par défaut fictives (`TODO`, `00000000`, `12345678`) dans le paramétrage initial.

## Decision

1. **Moteur fiscal unique (J1 / P2)** :
   - `packages/database/src/fiscal/index.ts` établit `computeTotals` comme l'unique moteur mathématique pur pour les calculs HT, CSS, TPS, TVA et TTC avec arrondi bancaire OHADA/CEMAC à l'entier XAF.
   - `calculateFiscalCascade` est conservé comme adaptateur rétrocompatible déprécié déléguant sans duplication vers `computeTotals`.
   - `IFiscalResult` expose `netHT` comme standard officiel tout en assurant la transition avec `netHt`.

2. **Modularisation du main Electron (J2 / P5)** :
   - Découpage de `apps/desktop/main.js` (réduit à ~175 lignes d'orchestration) en modules spécialisés sous `apps/desktop/main/` :
     - `logging.js` : rotation et journalisation persistance dans `userData/main.log`.
     - `secrets.js` : génération et persistance chiffrée des secrets cryptographiques de session.
     - `backup.js` : exécution quotidienne de sauvegardes SQLite vérifiées avec rétention de 7 jours.
     - `server.js` : détection dynamique de ports libres, lancement supervisé du standalone Next.js via `utilityProcess`, et nettoyage anti-zombie Windows (`taskkill /T /F`).
     - `window.js` : résolution des icônes de fenêtre, affichage du splash screen et confinement d'URL sécurisé.
     - `updater.js` : gestion du cycle de vie des mises à jour `electron-updater`.
     - `ipc.js` : enregistrement de tous les gestionnaires IPC avec contrôle strict de la provenance (`validateSender`).

3. **Découpage de l'onboarding Setup (J3)** :
   - Réécriture de `setup-client.tsx` (145 lignes) orchestrant un hook de machine d'état (`useSetupWizard.ts`), un panneau de prévisualisation de spécimen (`SetupLeftPanel.tsx`), et des étapes modulaires (`StepIdentity.tsx`, `StepBilling.tsx`, `StepBank.tsx`, `StepSecurity.tsx`, `StepAdmin.tsx`).

4. **Découpage des pages applicatives > 700 lignes (J4)** :
   - Toutes les pages cibles ont été refactorisées sous la barre des 300 lignes :
     - `clients.tsx` (290 l.) avec `ClientViews.tsx`, `ClientFormDialog.tsx`, `ClientDeleteDialog.tsx`, `ClientDetailsDialog.tsx`.
     - `services.tsx` (240 l.) avec `ServiceViews.tsx`, `ServiceFormDialog.tsx`, `ServiceDeleteDialog.tsx`, `ServiceDetailsDialog.tsx`.
     - `invoices.tsx` (260 l.) avec `InvoiceViews.tsx`, `PaymentDialog.tsx`, `InvoiceDeleteDialog.tsx`, `InvoiceCancelDialog.tsx`.
     - `quotes.tsx` (240 l.) avec `QuoteViews.tsx`, `QuoteDeleteDialog.tsx`.
     - `invoice-editor.tsx` (290 l.) et `quote-editor.tsx` (290 l.) avec les composants partagés `ClientSelectCard.tsx`, `EditorItemsTable.tsx`, `FiscalSummaryCard.tsx`.

5. **Découpage du store en Slices (J5)** :
   - Séparation du store Zustand sous `apps/desktop/lib/store/` en tranches étanches : `authSlice`, `clientsSlice`, `quotesSlice`, `invoicesSlice`, `settingsSlice`, combinées dans un `store.ts` de 50 lignes avec persistance `localStorage`.

6. **Logger contextuel et Typage durci (J6)** :
   - Création de `apps/desktop/lib/logger.ts` masquant automatiquement les clés sensibles (`password`, `token`, `secret`, `cookie`).
   - Élimination des directives `@ts-ignore` (notamment sur `exceljs`) par une déclaration d'ambiance `types/exceljs.d.ts`.

7. **Validation anti-placeholders fiscaux (J7 / P7)** :
   - Fonctions strictes de vérification `isValidGabonNif`, `isValidGabonRccm`, et `isValidIban` interdisant les valeurs fictives tout en autorisant les champs optionnels vides.

## Risks

- Risk: Régression visuelle ou perte de synchronisation d'état local lors de la modularisation des formulaires de facturation.
- Mitigation: Validation par les tests unitaires existants (276 tests passés sans régression) et typecheck strict TypeScript avec options mémoires adéquates.

## Verification

- Command: `npm run typecheck --workspace=facturier-desktop`
- Test: `npm test --workspace=facturier-desktop`
- Manual check: `npm run quality:decisions` validant la conformité des fiches d'architecture.
