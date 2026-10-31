# ADR-0047: Phase 4 Ergonomie Cognitive des Éditeurs, Sémantique des Avoirs et Cohérence des Aperçus A4/PDF

## Status

Accepted

## Scope

- Area: Application Desktop (`apps/desktop`), UX Cognitive Formulary, Documents d'Aperçu (A4 & PDF), Filtres & Sémantique Métier
- Library or platform: facturier-desktop, Next.js 16, React 19, @react-pdf/renderer, Radix UI
- Installed version: facturier-desktop@1.0.0, turbo@2.11.9, vitest@4.1.11
- Related files:
  - `apps/desktop/components/editor/DocumentCommercialHeader.tsx`
  - `apps/desktop/components/editor/UserRoleSelector.tsx`
  - `apps/desktop/components/editor/PasswordStrengthIndicator.tsx`
  - `apps/desktop/components/editor/UserSummaryCard.tsx`
  - `apps/desktop/components/pages/quote-editor.tsx`
  - `apps/desktop/components/pages/invoice-editor.tsx`
  - `apps/desktop/components/pages/user-editor.tsx`
  - `apps/desktop/components/layout/navigation.tsx`
  - `apps/desktop/components/layout/command-menu.tsx`
  - `apps/desktop/components/pages/credit-notes.tsx`
  - `apps/desktop/components/features/credit-notes/CreditNoteViews.tsx`
  - `apps/desktop/components/features/document-a4/A4Header.tsx`
  - `apps/desktop/components/features/document-a4/A4FiscalSummary.tsx`
  - `apps/desktop/components/document-a4.tsx`
  - `apps/desktop/components/pdf-document.tsx`
  - `apps/desktop/components/pdf/pdf-styles.ts`
  - `apps/desktop/lib/utils/amount-in-words.ts`
  - `apps/desktop/app/globals.css`
  - `apps/desktop/scripts/seed_multiyear.ts`

## Documentation Source

- Context7 source: `/pmndrs/zustand`, `/vercel/next.js`, `/radix-ui/primitives`
- Official fallback source: Normes DGI Gabon, Acte Uniforme OHADA (Droit Commercial Général), Gestalt Principles of Design & Cognitive Load Theory (Miller, Fitts, Hick)
- Date checked: 2026-10-30

## Context

L'audit approfondi des captures d'écran et des interfaces Devis, Factures, Avoirs et Documents a mis en lumière plusieurs dettes visuelles, incohérences sémantiques et frictions ergonomiques :
1. **Fragmentation Visuelle des Éditeurs (Devis & Factures)** :
   - L'écran de création de devis et de factures empilait deux cartes blanches volumineuses (*Informations du Document* et *Client*) occupant près de 400px de hauteur, reléguant la table des prestations hors de l'écran visible (*below the fold*) et forçant un défilement vertical immédiat.
2. **Jargon Comptable Obscur ("Avoirs")** :
   - Le terme "Avoirs" employé isolément dans la barre latérale et les en-têtes constitue un jargon technique inaccessible pour les utilisateurs profanes (artisans, gérants de PME, commerçants).
3. **Conflit Visuel et Doublon de Filtrage (`InvoiceFilterBar`)** :
   - Présence simultanée de pastilles de filtre rapide (`Toutes`, `À encaisser`, `Payées`) et d'un menu déroulant `Select` proposant exactement les mêmes choix sur la même ligne, créant une confusion de priorité et un conflit d'état.
4. **Fuite d'Identifiants Bruts (UUIDs)** :
   - La liste des avoirs affichait le raw UUID de la facture liée (`b1cb91d7-31f3...`) au lieu de son numéro de référence commercial canonique (`FAC-094/GM/2026`).
5. **Incohérences Sémantiques et Valeurs Codées en Dur dans les Aperçus (A4 & PDF)** :
   - Pour les Devis : Affichage du libellé trompeur *"Net à Payer"* (anxiogène pour une proposition commerciale non exécutoire).
   - Pour les Avoirs : Affichage des mentions *"Réglé"* et *"Reste à Payer"* (aberration comptable pour une note de crédit ou un remboursement client).
   - Pour l'export PDF : Présence de chaînes codées en dur (*"Moanda, le..."*, *"BP: 111 LIBREVILLE"*, *"Compte BGFI N°..."*, et omission de la TPS 9.5%).
6. **Scrollbars invasives sous Windows** :
   - Absence de style de barre de défilement, causant l'apparition de l'ascenseur Win32 natif de 17px qui empiète sur les marges intérieures des cartes.

## Decision

1. **Unification de l'En-tête Commercial (`DocumentCommercialHeader.tsx`)** :
   - Fusion de la sélection client et des métadonnées (Dates d'émission/échéance/validité et Objet) dans une carte unifiée à 2 colonnes équilibrées.
   - Réduction de la hauteur de l'en-tête de plus de 50%, garantissant l'affichage immédiat de la table des prestations sans défilement (Lois de Gestalt et de Fitts).
   - Intégration dans `quote-editor.tsx` (387L) et `invoice-editor.tsx` (378L), respectant rigoureusement la règle M-400.
   - Raccourcis universels `Ctrl+S` / `Cmd+S` et garde-fous anti-perte de données `useUnsavedChangesGuard` sur les deux éditeurs commerciaux.
2. **Refonte Ergonomique de l'Éditeur Utilisateur (`user-editor.tsx` & `UserRoleSelector.tsx`)** :
   - Remplacement du menu déroulant brut par des tuiles de sélection visuelle (`UserRoleSelector.tsx`) explicitant les permissions et responsabilités respectives (Opérateur vs Administrateur) sans jargon.
   - Jauge d'estimation de robustesse du mot de passe en temps réel (`PasswordStrengthIndicator.tsx`) avec critères de sécurité visuels (8 car., majuscule/minuscule, chiffre).
   - Fiche récapitulative dynamique (`UserSummaryCard.tsx`) avec avatar, badge de statut et raccourci clavier `Ctrl+S`.
3. **Vulgarisation Sémantique : "Avoirs & Remboursements"** :
   - Renommage officiel du module dans la barre de navigation latérale, le menu de commande (`command-menu.tsx`), le header de page et les boutons d'action (*"Nouvel avoir / remboursement"*).
4. **Résolution du Conflit de la Facture Liée** :
   - Résolution dynamique de l'objet facture dans `CreditNotesPage` et transmission de `invoiceNumber` à `CreditNoteViews` (table et cartes) et à `PDFDocument`, éradiquant tout affichage d'UUID brut au profit du numéro canonique.
5. **Standardisation et Perfectionnement des Aperçus (A4 & PDF)** :
   - **Devis** : Libellé clarifié en *"Total Estimé TTC"*, arrestation du montant estimatif en toutes lettres.
   - **Avoirs** : Libellé adapté en *"Montant Avoir TTC (Crédit)"*, neutralisation des lignes de reste à payer, et affichage de la référence de la facture rectifiée (`A4Header.tsx` et `PDFDocument`).
   - **Export PDF (`pdf-document.tsx`)** : Remplacement des constantes codées en dur par les métadonnées dynamiques de l'entreprise (ville, banque, NIF/RCCM), intégration de la TPS 9.5% dans la cascade fiscale, et modularisation dans `pdf-styles.ts` pour respecter la règle M-400.
   - **Arrestation en toutes lettres (`amount-in-words.ts`)** : Conversion automatique des sommes en français selon les normes OHADA/CEMAC pour Devis, Factures et Avoirs.
6. **Intégration d'Ascenseurs Discrets (Desktop Scrollbars)** :
   - Ajout dans `apps/desktop/app/globals.css` des règles Chromium natives (`::-webkit-scrollbar` de 6px avec thumb semi-transparent adaptatif dark/light).
7. **Conformité des Seeds** :
   - Harmonisation des générateurs de seeds (`seed_multiyear.ts`) sur la numérotation canonique DGI Gabon (`FAC-094/GM/2026`, `DEV-050/GM/2026`, `AVR-001/GM/2026`).

## Consequences

- **Positives** :
  - Fluidité et vitesse de saisie accrues sur les éditeurs de devis et factures (accès immédiat aux prestations sans défilement).
  - Compréhension immédiate par les profanes grâce au renommage "Avoirs & Remboursements".
  - Zéro fuite de données techniques (UUIDs masqués par les numéros commerciaux lisibles).
  - Documents A4 et PDF parfaitement conformes sur les plans juridique, comptable et fiscal gabonais.
  - 100% des fichiers de production sous la barre des 400 lignes (règle M-400 validée).
- **Négatives** :
  - Nécessité de maintenir la synchronisation visuelle entre l'aperçu A4 HTML et le moteur `@react-pdf/renderer`.

## Risks

- **Risque d'incohérence entre aperçu écran HTML et rendu PDF natif** : Mitigé par l'alignement strict des constantes de libellés et des cascades fiscales (Brut HT, Remise, Net HT, CSS, TPS, TVA, TTC).
- **Risque de régression sur les formulaires de devis et factures suite à l'unification de l'en-tête** : Mitigé par la préservation intégrale des signatures d'événements et le passage à 100% des 54 suites de tests Vitest (306 tests validés).

## Verification

- `npm run typecheck` : 0 erreur TypeScript sur l'ensemble du monorepo (4 packages).
- `npm run test --prefix apps/desktop` : 55 fichiers de test passés, 312 tests réussis avec succès.
- `npm run quality:desktop-health` : 147 fichiers scannés, 100% conformes à la règle M-400 (< 400 lignes).
- `npm run quality` : 47 fiches ADR validées et garde-fous de santé validés.
