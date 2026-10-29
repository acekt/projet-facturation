# ADR-0044: Phase 1 Plan Correctif Desktop — Stabilité, Cohérence Fonctionnelle et Ergonomie

## Status

Accepted

## Scope

- Area: Client lourd Desktop (`apps/desktop`), Cohérence fonctionnelle des écrans, Résilience Electron, Migrations SQLite
- Library or platform: facturier-desktop, Electron, Next.js 16, better-sqlite3, Zustand v5
- Installed version: facturier-desktop@1.0.0, electron@35.x, next@16.1.6, better-sqlite3@12.x
- Related files:
  - `apps/desktop/components/pages/settings.tsx`
  - `apps/desktop/components/pages/credit-notes.tsx`
  - `apps/desktop/components/features/credit-notes/CreateCreditNoteModal.tsx`
  - `apps/desktop/components/pages/invoices.tsx`
  - `apps/desktop/components/pages/invoices/InvoiceViews.tsx`
  - `apps/desktop/components/pages/users.tsx`
  - `apps/desktop/components/pages/user-editor.tsx`
  - `apps/desktop/components/layout/command-menu.tsx`
  - `apps/desktop/lib/command-navigation.ts`
  - `apps/desktop/components/dashboard/admin.tsx`
  - `apps/desktop/main/window.js`
  - `apps/desktop/main/ipc.js`
  - `apps/desktop/lib/db.ts`
  - `apps/desktop/lib/db/migrations/0003_backfill_and_sync_schema.ts`

## Documentation Source

- Context7 source: `/electron/electron`, `/vercel/next.js`, `/pmndrs/zustand`, `/wiselibs/better-sqlite3`
- Official fallback source: Electron Security Guidelines (#17 IPC sender validation & crash recovery), RFC 4180 CSV specification, OHADA accounting rules
- Date checked: 2026-10-29

## Context

L'audit approfondi de l'application Desktop (`apps/desktop`) a mis en évidence 9 anomalies fonctionnelles et de cohérence (C1 à C9) entre le moteur métier et l'interface utilisateur :
1. **C1** : Initialisation erronée de `cssRate` à `0` au lieu du taux légal gabonais de `1%` dans `SettingsPage`.
2. **C2** : Export CSV non échappé et fuite mémoire (`URL.createObjectURL` non révoqué) dans `CreditNotesPage`.
3. **C3 & C4** : Absence d'interface pour émettre un avoir partiel ou total OHADA (`CreateCreditNoteModal`) et absence de prévisualisation A4 (`FullScreenDocumentViewer`) sur les avoirs.
4. **C5** : Duplication entre les modales internes d'ajout/édition de `UsersPage` (652 lignes) et la page dédiée `UserEditor`.
5. **C6** : Perte de contexte lors de la sélection d'une facture, d'un client ou d'un service dans la palette `CommandMenu` (`Ctrl+K`).
6. **C7 & U3** : Métriques figées dans `DashboardAdmin` (absence de rafraîchissement réactif sur `facturier:data-refresh` et de sélecteur de période) et texte brut au lieu de `<DashboardSkeleton />`.
7. **C8 & C9** : Absence de reprise automatique bornée sur `render-process-gone` dans Electron et exécution de requêtes SQL de backfill hors migration versionnée à chaque chargement de `lib/db.ts`.

## Decision

1. **Exactitude Fiscale & Sécurité CSV (`C1`, `C2`)** :
   - Correction du fallback `cssRate: settings.cssRate ?? 1` dans `SettingsPage`.
   - Renforcement de `escapeCsvCell` contre l'injection de formules tableur (`=`, `@`, `+CMD`, `-CMD`) et ajout de `downloadSafeCsv` avec `URL.revokeObjectURL` systématique dans `lib/utils.ts`.
2. **Double Point d'Entrée Avoirs OHADA & Aperçu A4 (`C3`, `C4`)** :
   - Création du composant partagé `CreateCreditNoteModal` accessible depuis l'en-tête de `CreditNotesPage` (« Nouvel avoir ») et depuis le menu contextuel de chaque facture dans `InvoicesPage` (« Émettre un avoir »), avec calcul temps réel du plafond remboursable TTC.
   - Intégration de `FullScreenDocumentViewer` (`type="avoir"`) dans `CreditNotesPage`.
3. **Unification Maître-Détail Utilisateurs & Navigation Contextuelle `Ctrl+K` (`C5`, `C6`)** :
   - Suppression des modales internes redondantes dans `UsersPage` (réduit de 652 à 360 lignes) au profit de `UserEditor`.
   - Création de `lib/command-navigation.ts` (`dispatchCommandNavigation`, `useCommandFilter`) pour pré-filtrer automatiquement la facture, le client ou le service sélectionné depuis `Ctrl+K`.
4. **Réactivité du Dashboard Admin & Squelettes (`C7`, `U3`)** :
   - Ajout du sélecteur de période (`30 jours`, `Trimestre`, `Année`), écoute de `facturier:data-refresh` et affichage de `<DashboardSkeleton />` dans `DashboardAdmin`.
5. **Résilience Electron & Migration SQLite `0003` (`C8`, `C9`)** :
   - Ajout de l'écouteur `render-process-gone` avec reprise bornée (max 3 rechargements par fenêtre de 60s) dans `main/window.js` et vérification `frame.parent === null` dans `main/ipc.js`.
   - Encapsulation du backfill `created_by` et de `ensureSyncSchema` dans la migration versionnée `0003_backfill_and_sync_schema.ts` avec garde `globalForDb.db_ready` dans `lib/db.ts`.

## Risks

- **Risque de dépassement du plafond remboursable sur avoirs multiples** : Mitigé à la fois dans l'UI (`CreateCreditNoteModal` bloque la soumission si `computedTotals.total > maxRefundableTtc`) et côté serveur dans `CreditNoteService.createCreditNote`.
- **Risque de boucle infinie en cas de crash répété du renderer Electron** : Mitigé par la fenêtre glissante `CRASH_COOLDOWN_MS = 60000` limitée à `MAX_CRASH_RECOVERIES = 3`.

## Verification

- Suite de tests unitaires dédiée `apps/desktop/tests/unit/desktop-phase1-correctif.test.ts` validant les correctifs C1 à C9.
- Exécution complète des suites Vitest de `apps/desktop` et validation ADR via `npm run quality:decisions`.

