# ADR-0045: Phase 2 Plan Curatif Desktop — Modularité, Typage Strict et Psychologie du Design

## Status

Accepted

## Scope

- Area: Client lourd Desktop (`apps/desktop`), Modularité des pages et composants, Typage strict sans `any`, Design Psychology UI/UX
- Library or platform: facturier-desktop, Next.js 16, React 19, Zustand v5, ExcelJS, Better-SQLite3
- Installed version: facturier-desktop@1.0.0, react@19.2.0, next@16.4.3, zustand@5.0.13
- Related files:
  - `apps/desktop/components/pages/settings.tsx`
  - `apps/desktop/components/features/settings/CompanySettingsTab.tsx`
  - `apps/desktop/components/features/settings/BillingSettingsTab.tsx`
  - `apps/desktop/components/features/settings/BankSettingsTab.tsx`
  - `apps/desktop/components/features/settings/SecuritySettingsTab.tsx`
  - `apps/desktop/components/document-a4.tsx`
  - `apps/desktop/components/features/document-a4/A4Header.tsx`
  - `apps/desktop/components/features/document-a4/A4FiscalSummary.tsx`
  - `apps/desktop/components/features/document-a4/A4Footer.tsx`
  - `apps/desktop/components/pages/quote-editor.tsx`
  - `apps/desktop/components/pages/credit-notes.tsx`
  - `apps/desktop/components/features/credit-notes/CreditNoteViews.tsx`
  - `apps/desktop/components/pages/audit-logs.tsx`
  - `apps/desktop/components/layout/navigation.tsx`
  - `apps/desktop/lib/services/ExportService.ts`
  - `apps/desktop/lib/services/excel-styles.ts`
  - `apps/desktop/lib/utils/action-error.ts`
  - `apps/desktop/hooks/use-keyboard-shortcuts.ts`
  - `apps/desktop/hooks/use-unsaved-changes-guard.ts`
  - `apps/desktop/types/electron.d.ts`

## Documentation Source

- Context7 source: `/pmndrs/zustand` (v5 `useShallow` selectors), `/vercel/next.js`, `/electron/electron`
- Official fallback source: Laws of UX (Miller's Law, Fitts's Law, Von Restorff effect, Poka-Yoke), OHADA General Invoicing Guidelines
- Date checked: 2026-10-29

## Context

Dans le cadre du Master Plan d'audit et de modernisation de l'application Desktop (`facturier-desktop`), la Phase 2 (Plan Curatif) adresse les dettes structurelles, de typage et d'expérience utilisateur :
1. **Fichiers monolithes (> 400 lignes)** : `settings.tsx` (543L), `document-a4.tsx` (590L), `credit-notes.tsx` (446L), `quote-editor.tsx` (436L) et `ExportService.ts` (410L) dépassaient le seuil de maintenabilité de 400 lignes et mélangeaient logiques d'orchestration, de rendu et de formatage.
2. **Typage lâche et usage de `: any`** : Présence de clauses `catch (err: any)` ou `catch (e: any)` dans les Server Actions et les flux d'authentification/synchronisation, masquant les erreurs et empêchant une gestion fine des messages utilisateurs.
3. **Ergonomie et Psychologie Cognitive** :
   - Navigation latérale non structurée mélangeant fonctions d'exploitation commerciale et administration système (violation de la Loi de Miller 7±2).
   - Manque d'uniformité de la grille `PageHeader` / `SearchBar` sur `AuditLogsPage`.
   - Absence de raccourcis clavier applicatifs pour accélérer la saisie (`Ctrl+S`, `Ctrl+N`) et absence de garde-fou contre la perte accidentelle de données non sauvegardées (`isDirty`).
   - Absence de filtres saillants pour le recouvrement rapide des impayés (Effet Von Restorff).

## Decision

1. **Lot Curatif A — Découpage Chirurgical des Monolithes (< 400 lignes)** :
   - `SettingsPage` (183L) : Découpée en 4 sous-onglets spécialisés (`CompanySettingsTab`, `BillingSettingsTab`, `BankSettingsTab`, `SecuritySettingsTab`) dans `components/features/settings/`.
   - `DocumentA4` (286L) : Découpé en composants modulaires (`A4Header`, `A4FiscalSummary`, `A4Footer`) dans `components/features/document-a4/`.
   - `CreditNotesPage` (218L) : Logique d'affichage (table, horizontal, grille) extraite dans `CreditNoteViews.tsx` (215L).
   - `QuoteEditor` (380L) : Boilerplate de mutations unifié avec `useUnsavedChangesGuard` et suppression des casts `as any`.
   - `ExportService` (296L) : Fonctions de style et de téléchargement extraites dans `lib/services/excel-styles.ts`.
2. **Lot Curatif B — Typage Strict et Zéro `any`** :
   - Création de `lib/utils/action-error.ts` exposant `getErrorMessage(err: unknown)` et typage d'action `ActionResult<T>`.
   - Éradication de l'ensemble des `catch (err: any)` au profit de `catch (err: unknown)` dans `invoice.actions.ts`, `quote.actions.ts`, `credit-note.actions.ts`, `settings.actions.ts`, `auth.actions.ts`, `user.actions.ts`, `sync.actions.ts`, `setup.actions.ts`, `login-client.tsx`, `fullscreen-document-viewer.tsx` et `CloudSyncService.ts`.
   - Typage de `types/electron.d.ts` sans `any`.
   - Intégration de `useShallow` de Zustand v5 sur tous les sélecteurs multi-champs (`navigation.tsx`, `invoices.tsx`, `quotes.tsx`, `clients.tsx`, `services.tsx`, `credit-notes.tsx`, `settings.tsx`, `quote-editor.tsx`).
3. **Lot Curatif C — Design Psychology & Ergonomie Desktop** :
   - **Loi de Miller (Chunking)** : Navigation latérale structurée en 3 groupes cognitifs clairs (*Pilotage & Ventes*, *Référentiel*, *Gouvernance*) avec badges dynamiques des impayés et devis en attente.
   - **Loi de Jakob & Cohérence Gestalt** : Harmonisation de `AuditLogsPage` avec `PageHeader` et `SearchBar`.
   - **Loi de Fitts & Poka-Yoke** : Création de `useKeyboardShortcuts` (`Ctrl+S`, `Ctrl+N`, `Échap`) et de `useUnsavedChangesGuard` (prévention des pertes de données non enregistrées).
   - **Effet Von Restorff & Règle Pic-Fin** : Ajout de filtres rapides saillants « À encaisser » sur `InvoicesPage` et application de la classe typographique fintech `tabular-nums` pour éliminer le sautillement visuel des chiffres.

## Consequences

- **Positives** :
  - 100 % des composants et services modifiés respectent le plafond strict de 400 lignes par fichier.
  - Zéro clause `catch (err: any)` dans le code applicatif desktop.
  - Abonnements Zustand optimisés par comparaison superficielle (`useShallow`), réduisant drastiquement les re-rendus inutiles.
  - Navigation plus fluide, intuitive et conforme aux lois psychologiques du design moderne.
- **Négatives / Risques** :
  - Nécessité de veiller à ce que les futurs sous-composants ne réintroduisent pas de logique métier dupliquée sans passer par les hooks ou actions serveur dédiées.

## Risks

- **Risque de régression lors du découpage des sous-onglets de `settings.tsx` et `document-a4.tsx`** : Mitigé par le maintien strict des interfaces de props et des sélecteurs de style, vérifié par la suite de tests unitaires et le rendu en production.
- **Risque d'erreurs non interceptées lors du passage de `any` à `unknown`** : Mitigé par l'utilitaire centralisé `getErrorMessage` qui inspecte les instances `Error`, les objets avec propriété `message`/`error`, et applique un message de repli convivial.

## Verification

- Suite de tests unitaires dédiée `apps/desktop/tests/unit/desktop-phase2-curatif.test.ts` (8 tests) validant `getErrorMessage`, les 3 groupes de la Loi de Miller, et les formateurs de statuts/dates.
- Exécution de l'ensemble des suites `apps/desktop` avec Vitest (21/21 tests passés).
- Validation de l'arbre décisionnel via `npm run quality:decisions`.
