# ADR-0066: Fixed Page Headers Architecture, Audit Export Integration, and Premium Service Picker

## Status

Accepted

## Scope

- Area: Global Page Layout, Scroll Isolation, Audit Export Integration, Service Selector UX
- Library or platform: Next.js 16, React 19, Tailwind CSS, Lucide React, Better-SQLite3
- Installed version: next 16.0.0, react 19.0.0
- Related files:
  - `apps/desktop/components/features/common/PageHeader.tsx`
  - `apps/desktop/components/features/common/SortSelect.tsx`
  - `apps/desktop/components/features/export/DataExportModal.tsx`
  - `apps/desktop/components/pages/audit-logs.tsx`
  - `apps/desktop/components/pages/ledger.tsx`
  - `apps/desktop/components/pages/stock.tsx`
  - `apps/desktop/components/pages/invoices.tsx`
  - `apps/desktop/components/pages/quotes.tsx`
  - `apps/desktop/components/pages/credit-notes.tsx`
  - `apps/desktop/components/pages/clients.tsx`
  - `apps/desktop/components/pages/services.tsx`
  - `apps/desktop/components/pages/users.tsx`
  - `apps/desktop/components/pages/settings.tsx`
  - `apps/desktop/components/dashboard/admin.tsx`
  - `apps/desktop/components/dashboard/user.tsx`
  - `apps/desktop/components/pages/invoice-editor.tsx`
  - `apps/desktop/components/pages/quote-editor.tsx`
  - `apps/desktop/components/pages/user-editor.tsx`
  - `apps/desktop/components/editor/EditorItemsTable.tsx`
  - `apps/desktop/components/pages/services/ServiceFormDialog.tsx`
  - `apps/desktop/components/pages/ledger/LedgerEntryDialog.tsx`

## Documentation Source

- Context7 source: `/radix-ui/primitives`, `/tailwindlabs/tailwindcss`, `/vercel/next.js`
- Official fallback source: React 19 component patterns, Tailwind CSS scroll & layout standards
- Date checked: 2026-11-05

## Context

1. **Défilement et visibilité des en-têtes (Loi de Fitts & Seuil de Doherty)** :
   - Auparavant, sur plusieurs pages critiques de l'application (notamment le Livre des Comptes, la Gestion des Stocks, le Journal d'Audit et les listes principales), le défilement s'appliquait sur l'intégralité du conteneur vertical.
   - Lorsque l'utilisateur parcourait une longue liste d'écritures ou d'articles, les boutons d'action ("Nouvelle Recette", "Export Excel", "Nouveau service", etc.) et les filtres temporels disparaissaient de l'écran, contraignant à remonter manuellement tout en haut.
   - Il était requis d'isoler l'en-tête et les filtres dans une zone statique rigide (`shrink-0 z-10`), de rendre uniquement le corps de données défilable (`flex-1 overflow-y-auto min-h-0`), et de maintenir le pied de pagination ancré en bas.

2. **Intégration du Centre d'Exportation dans le Journal d'Audit** :
   - Le Journal d'Audit disposait d'un export direct mais n'était pas harmonisé avec la modale globale unifiée `DataExportModal`.
   - Il était nécessaire d'étendre `DataExportModal` pour supporter le scope `"audit"` (avec filtrage par période/action, export Excel stylisé OpenXML et CSV sécurisé avec BOM UTF-8 `\uFEFF`).

3. **Expérience utilisateur du sélecteur de services dans les éditeurs (`EditorItemsTable.tsx`)** :
   - L'ancien sélecteur `<Select>` natif manquait de flexibilité : pas de recherche interactive, pas d'indication visuelle en temps réel des stocks disponibles / en rupture, et pas de pré-remplissage immédiat du tarif unitaire.
   - Les opérateurs avaient besoin d'un Popover enrichi avec champ de recherche en direct, badges d'état de stock en temps réel (`Stock dispo : X`, `Stock faible : X`, `Rupture de stock`, ou `Prestation sans stock`), affichage du prix unitaire en FCFA et bouton rapide d'ajout de prestation `+ Nouveau service`.

4. **Standardisation du tri et enrichissement des formulaires** :
   - Les sélecteurs de tri étaient dispersés et hétérogènes.
   - Les formulaires de saisie manquaient parfois de placeholders descriptifs guidant les utilisateurs opérationnels.

## Decision

1. **Architecture Unifiée des En-têtes et du Défilement (Layout Rigide 3 Zones)** :
   - Chaque page de liste implémente la structure standard :
     * Conteneur racine : `div className="flex flex-col h-full overflow-hidden"`
     * En-tête statique : `div className="shrink-0 pb-4 border-b border-border bg-background z-10 space-y-4"` contenant le composant unifié `<PageHeader />`, les barres de recherche et de filtres.
     * Zone de contenu défilable : `div className="flex-1 overflow-y-auto min-h-0 pt-4 pr-1 space-y-4"` contenant les tableaux ou grilles de cartes.
     * Pied de pagination fixe : `div className="shrink-0 pt-3 border-t border-border bg-background"` contenant `<Pagination />`.
   - Déployé sur `invoices.tsx`, `quotes.tsx`, `credit-notes.tsx`, `stock.tsx`, `ledger.tsx`, `clients.tsx`, `services.tsx`, `users.tsx`, `audit-logs.tsx`, `settings.tsx`, `DashboardAdmin`, `DashboardUser`, `InvoiceEditor`, `QuoteEditor` et `UserEditor`.
   - Correction de l'alignement de la grille dans `EditorItemsTable.tsx` (5-2-2-2-1 colonnes) et intégration de `CreationSuccessModal` dans `UserEditor.tsx`.

2. **Support Complet de l'Entité Audit dans `DataExportModal`** :
   - Ajout des scopes `"audit"` et `"audit-logs"` dans `ExportScope` et normalisation dans `normalizeScope`.
   - Récupération dynamique via `getAuditLogs()` et application des filtres de date et d'action.
   - Génération d'exports Excel OpenXML avec en-têtes bilingues et mise en page comptable, et exports CSV avec encodage UTF-8 BOM.
   - Câblage du bouton `"Export Excel"` du Journal d'Audit pour ouvrir la modale avec `initialEntity="audit"`.

3. **Popover Enrichi de Sélection de Services (`EditorItemsTable.tsx`)** :
   - Implémentation du sous-composant `ServicePicker` reposant sur `@workspace/ui/components/popover`.
   - Zone de recherche instantanée filtrant par désignation ou catégorie.
   - Badges d'état de stock conditionnels : vert émeraude (`Stock dispo`), ambre (`Stock faible`), rouge destructif (`Rupture de stock`) ou neutre (`Prestation sans stock`).
   - Clic sur un service pré-remplissant simultanément la description et le prix unitaire HT.
   - Bouton `+ Nouveau service` intégré pour ouvrir `ServiceFormDialog` sans quitter l'éditeur de facture/devis.

4. **Standardisation du Tri et des Placeholders** :
   - Création du composant réutilisable `<SortSelect />` avec les modes `currency`, `quantity` et `standard`.
   - Ajout de placeholders professionnels et descriptifs dans `LedgerEntryDialog`, `ClientFormDialog`, `user-editor`, `UserModals` et `ServiceFormDialog`.

## Alternatives Considered

- Maintenir un défilement complet de la page : Rejeté car cela dégradait l'ergonomie lors de l'analyse de grands volumes de données.
- Utiliser un simple autocomplète textuel pour les services : Rejeté car il ne permettait pas de visualiser l'état des stocks physiques et les catégories en un coup d'œil.

## Risks

- *Risque* : Consommation mémoire ou surcharge de requêtes lors de l'ouverture du sélecteur de services.
- *Atténuation* : Le filtrage de la liste de services s'effectue en mémoire via `React.useMemo` sur le store Zustand déjà initialisé, sans requête réseau supplémentaire.

## Verification

- Command: `npm run typecheck --workspace=facturier-desktop`
- Test: `npm run test --workspace=facturier-desktop`
- Decision Quality: `npm run quality:decisions`

