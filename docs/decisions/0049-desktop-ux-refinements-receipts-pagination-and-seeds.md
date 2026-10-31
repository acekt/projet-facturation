# ADR-0049: Harmonisation Visuelle Approfondie, Reçus d'Avoir, Découpage M-400 et Alignement des Seeds

## Status

Accepted

## Scope

- Area: Application Desktop (`apps/desktop`), Reçus d'Avoir, Pagination Grille 3x3, Protection OOM Renderer, Données de Test (Seed Multi-années), Export PDF & Aperçu A4
- Library or platform: facturier-desktop, Electron 42, Next.js 16, better-sqlite3, Vitest 4
- Installed version: facturier-desktop@1.0.0, turbo@2.11.9, vitest@4.1.11, electron@42.11.2
- Related files:
  - `apps/desktop/main.js`
  - `apps/desktop/main/window.js`
  - `apps/desktop/preload.js`
  - `apps/desktop/types/electron.d.ts`
  - `apps/desktop/components/features/credit-notes/CreateCreditNoteModal.tsx`
  - `apps/desktop/components/features/credit-notes/CreditNoteFormBody.tsx`
  - `apps/desktop/components/features/credit-notes/CreditNoteSuccessView.tsx`
  - `apps/desktop/components/pages/invoices/InvoiceViews.tsx`
  - `apps/desktop/components/pages/quotes/QuoteViews.tsx`
  - `apps/desktop/components/document-a4.tsx`
  - `apps/desktop/components/pdf-document.tsx`
  - `apps/desktop/components/dashboard/admin.tsx`
  - `apps/desktop/scripts/seed_multiyear.ts`
  - `packages/ui/src/components/data-table.tsx`

## Documentation Source

- Context7 source: `/electron/electron`, `/vercel/next.js`
- Official fallback source: Electron IPC Security & Memory Guidelines, OHADA Uniform Act on Commercial Invoicing, DGI Gabon
- Date checked: 2026-10-30

## Context

L'audit approfondi des interfaces et des comportements utilisateur a mis en évidence plusieurs anomalies subtiles mais critiques pour l'expérience et la conformité :
1. **Absence de Reçu et de Confirmation Visuelle après Remboursement / Avoir** :
   - Lorsqu'un utilisateur émettait un avoir, le modal se fermait brutalement avec un simple toast sans présenter le reçu comptable (numéro d'avoir, client, montant remboursé et solde résiduel de la facture).
2. **Inversion Commerciale "Objet" vs "Conditions Générales / Notes"** :
   - Dans le visualiseur A4 et le moteur d'exportation PDF, une facture sans objet explicite affichait les mentions légales ou les conditions de règlement à la place de l'objet commercial ("Objet : Paiement à 30 jours..."), créant une incohérence comptable.
3. **Troncature Agressive du Nom Client en Vue Tableau** :
   - La classe `max-w-0` dans le composant `DataTable` écrasait les cellules clients (`Airtel G...`, `Kori Tec...`) malgré un espace horizontal abondant à l'écran.
4. **Trous Visuels de Pagination en Vue Grille 3x3** :
   - Une taille de page non multiple de 3 (ex: 10) laissait une carte orpheline sur la dernière ligne avec un large espace blanc donnant la fausse impression d'une liste tronquée ou buggée, aggravée par l'absence de retour automatique en haut de page lors du changement de page.
5. **Flash Blanc Résiduel et Crash OOM Chromium** :
   - Le moteur Chromium pouvait saturer sa mémoire par défaut (512MB) lors de cycles de compilation dev intenses, et révélait le canevas de la fenêtre principale avant la fin du rendu React initial.
6. **Désalignement des Préfixes et Données de Seed Multi-années** :
   - Le script de peuplement générait des doublons de tirets (`FAC-GM--001`), des identifiants UUID bruts dans les journaux d'audit de paiements et mélangeait les objets commerciaux avec les notes légales.

## Decision

1. **Reçu Post-Remboursement Immédiat (`CreditNoteSuccessView`) et Découpage M-400** :
   - Intégration dans `CreateCreditNoteModal` d'un écran de succès affichant le récapitulatif complet de l'avoir émis : référence d'avoir, facture compensée, montant déduit et nouveau solde de la créance.
   - Extraction de `CreditNoteFormBody.tsx` garantissant la stricte conformité à la Règle M-400 (< 400 lignes par fichier).
2. **Clarification Stricte "Objet" vs "Notes & Conditions" (A4 et PDF)** :
   - L'affichage de la mention "Objet :" est réservé au véritable objet commercial (`subject`) ou au motif d'avoir (`reason`), avec masquage pur et simple en cas d'absence.
   - Les `notes` et mentions légales sont reléguées dans leur zone dédiée en pied de page fiscal.
3. **Protection de la Largeur de Colonne Client** :
   - Modification de `packages/ui/src/components/data-table.tsx` pour remplacer `max-w-0` par `max-w-[260px]` et configuration de `min-w-[180px]` sur les vues Factures et Devis.
4. **Harmonisation de la Grille 3x3 et Auto-Scroll** :
   - Fixation de `itemsPerPage = 9` (3 rangées complètes de 3 cartes) sur l'ensemble des modules.
   - Déclenchement automatique d'un défilement doux vers le haut (`scrollTo({ top: 0, behavior: "smooth" })`) à chaque changement de page ou de filtre dans `InvoiceViews` et `QuoteViews`.
5. **Handshake `app:report-ready` et Augmentation du Tas V8 (4 Go)** :
   - Ajout du switch Chromium `--js-flags="--max-old-space-size=4096"` dans `apps/desktop/main.js` pour prémunir le renderer contre les crashs OOM.
   - Implémentation du canal IPC sécurisé `app:report-ready` permettant au client React (`ProtectedAppShell`, `LoginClient`) de signaler son premier montage effectif, maintenant le splash screen actif jusqu'au rendu final sans aucun flash blanc.
6. **Harmonisation Canonique des Données de Test (`seed_multiyear.ts`)** :
   - Normalisation des préfixes en `FAC` et `DEV`, attribution d'objets commerciaux réels et enregistrement de journaux d'audit de règlements basés sur les numéros officiels de factures.

## Alternatives Considered

- *Alternative 1 (Fermeture immédiate avec toast seul pour les avoirs)* : Rejetée car les gestionnaires comptables nécessitent une validation visuelle immédiate de l'impact financier sur le solde client.
- *Alternative 2 (Pagination infinie ou scroll continu)* : Rejetée car incompatible avec l'exigence de traçabilité comptable et la pagination prédictive requise par la norme desktop locale.

## Risks

- *Risque* : Blocage du splash screen si le client React ne déclenche pas `app:report-ready`.
- *Atténuation* : Timeout de garde automatique de 4000 ms dans `main/window.js` pour forcer l'affichage de la fenêtre quoi qu'il arrive.

## Verification

- `node scripts/check-desktop-health.mjs` : 100% des fichiers sous la barre des 400 lignes.
- `node scripts/check-decision-records.js` : 49 fiches valides.
- `npm run typecheck` : 0 erreur TypeScript.
- `npm run seed --prefix apps/desktop` : Régénération complète et synchronisation SQLite validée.

