# ADR-0046: Phase 3 Plan Préventif Desktop — Garde-Fou de Santé Architecturale et Découpage Modulaire Continu

## Status

Accepted

## Scope

- Area: Application Desktop (`apps/desktop`), Surveillance continue de santé de code, Découpage sous-composants Dashboard & Utilisateurs, Intégration CI/CD
- Library or platform: facturier-desktop, Turborepo, Vitest, Next.js 16, React 19
- Installed version: facturier-desktop@1.0.0, turbo@2.11.9, vitest@4.1.11
- Related files:
  - `scripts/check-desktop-health.mjs`
  - `package.json`
  - `apps/desktop/components/dashboard/admin.tsx`
  - `apps/desktop/components/dashboard/DashboardRevenueChart.tsx`
  - `apps/desktop/components/dashboard/DashboardActivityTimeline.tsx`
  - `apps/desktop/components/pages/quotes/QuoteViews.tsx`
  - `apps/desktop/components/pages/user-editor.tsx`
  - `apps/desktop/components/editor/UserSummaryCard.tsx`
  - `apps/desktop/components/pages/users.tsx`
  - `apps/desktop/components/pages/users/UserModals.tsx`
  - `apps/desktop/components/pages/users/UserTableRow.tsx`
  - `apps/desktop/components/pdf-document.tsx`
  - `apps/desktop/vitest.config.ts`

## Documentation Source

- Context7 source: `/pmndrs/zustand`, `/vercel/next.js`, `/vitest-dev/vitest`
- Official fallback source: Martin Fowler Component Refactoring Guidelines, Clean Architecture (Single Responsibility Principle)
- Date checked: 2026-10-30

## Context

À la suite de la Phase 1 (Plan Correctif : sécurisation SQLite et numérotation DGI) et de la Phase 2 (Plan Curatif : découpage des premiers monolithes et zéro `any`), la Phase 3 (Plan Préventif) doit garantir que les gains de qualité et de modularité sont pérennisés de manière automatisée.
1. **Dépassements résiduels de la règle M-400 (> 400 lignes)** :
   - `admin.tsx` (490L) regroupait les métriques KPI, les graphiques Recharts d'évolution commerciale/paiements et la timeline du journal d'audit.
   - `users.tsx` (571L) intégrait simultanément la table des utilisateurs, le sélecteur de filtres, et quatre modales de confirmation (`Dialog`).
   - `user-editor.tsx` (418L) contenait à la fois le formulaire complet de création/édition et la carte latérale de récapitulatif utilisateur.
   - `QuoteViews.tsx` (405L) et `pdf-document.tsx` (401L) dépassaient légèrement la limite en raison de code dupliqué sur les dropdowns d'actions et de sauts de ligne superflus.
2. **Absence de barrière de contrôle automatique (Garde-Fou CI/CD)** :
   - Aucun script automatisé ne vérifiait la taille maximale des fichiers ou la santé des composants avant les builds ou livraisons.

## Decision

1. **Découpage modulaire chirurgical des composants volumineux** :
   - **Dashboard Admin** :
     - `DashboardRevenueChart.tsx` (138L) : Extraction de la zone graphique Recharts (AreaChart d'évolution commerciale et PieChart de répartition des modes de paiement).
     - `DashboardActivityTimeline.tsx` (65L) : Extraction du journal d'audit récent.
     - `admin.tsx` ramené de 490 lignes à **350 lignes**.
   - **Gestion des Utilisateurs** :
     - `UserModals.tsx` (172L) : Extraction des 4 boîtes de dialogue modales (changement de statut, suppression avec confirmation textuelle, génération/affichage de mot de passe temporaire).
     - `UserTableRow.tsx` (137L) : Extraction de la ligne de tableau avec avatar, badges et menu contextuel.
     - `UserSummaryCard.tsx` (65L) : Extraction de la carte latérale de résumé d'utilisateur.
     - `users.tsx` ramené de 571 lignes à **362 lignes**.
     - `user-editor.tsx` ramené de 418 lignes à **375 lignes**.
   - **Devis et Factures PDF** :
     - `QuoteViews.tsx` : Factorisation du composant interne `QuoteActionDropdown` réutilisé sur les 3 vues (table, horizontal, cartes), ramenant le fichier de 405 lignes à **358 lignes**.
     - `pdf-document.tsx` : Compactage des sections bancaires et pied de page à **399 lignes**.
2. **Automatisation du Garde-Fou de Santé (`scripts/check-desktop-health.mjs`)** :
   - Création du script de vérification continue qui analyse l'ensemble des fichiers TypeScript de production dans `apps/desktop/{app,components,lib,hooks}`.
   - Échoue automatiquement si un fichier de production dépasse la limite stricte de 400 lignes.
   - Intégration de la commande `npm run quality:desktop-health` et unification dans `npm run quality` (`npm run quality:decisions && npm run quality:desktop-health`).
3. **Résolution absolue du setup Vitest** :
   - Configuration de `setupFiles` dans `apps/desktop/vitest.config.ts` via `path.resolve(__dirname, './tests/setup.ts')` pour garantir l'exécution transparente des suites de tests depuis n'importe quel niveau du monorepo.

## Consequences

- **Positives** :
  - 100 % des fichiers de code applicatif et composants de `apps/desktop` sont désormais strictement sous le seuil des 400 lignes.
  - La commande `npm run quality` valide à la fois l'intégrité des 46 fiches ADR et le respect de la règle M-400 sur les 142 fichiers de production scannés.
  - La séparation des responsabilités entre conteneurs de page et sous-composants dédiés accroît la testabilité unitaire et accélère le cycle de développement.
- **Négatives / Risques** :
  - Nécessité de maintenir la discipline architecturale lors des développements futurs en exécutant systématiquement `npm run quality`.

## Risks

- **Risque de dispersion des props entre conteneurs et sous-composants extraits** : Mitigé par l'utilisation d'interfaces TypeScript explicites sans `: any` (`UserModalsProps`, `UserTableRowProps`, `DashboardRevenueChartProps`).
- **Risque de désynchronisation de l'état local dans les modales extraites** : Mitigé par le passage d'événements purs (`onOpenResetModal`, `onToggleStatus`) pilotés par le composant parent.

## Verification

- Exécution de `npm run quality:desktop-health` : 142 fichiers analysés, 0 violation, sortie avec code 0.
- Exécution de `npm run quality` : 46 fiches ADR validées et contrôle de santé desktop réussi à 100 %.
- Exécution de `npm run typecheck` : 3 packages validés, 0 erreur TypeScript.
- Exécution de la suite de tests unitaires utilisateurs (`tests/unit/components/pages/users.test.tsx`) : 3/3 tests passés.
