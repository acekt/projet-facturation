# ADR-0062: Executive Dashboard 360 Cross Charts, Financial Forecasts, Stock and Cashflow Visibility

## Status

Accepted

## Scope

- Area: Executive Dashboard, Financial Intelligence, Stock Metrics and Multi-Tenant Aggregations
- Library or platform: Better-SQLite3, Next.js 16, React 19, Recharts
- Installed version: better-sqlite3 ^11.0.0, next 16.0.0, react 19.0.0, recharts ^2.15.0
- Related files:
  - `packages/database/src/types/index.ts`
  - `apps/desktop/lib/types/api.ts`
  - `apps/desktop/lib/repositories/MetricsRepository.ts`
  - `apps/desktop/app/actions/dashboard.actions.ts`
  - `apps/desktop/components/dashboard/admin.tsx`
  - `apps/desktop/components/dashboard/DashboardRevenueChart.tsx`
  - `apps/desktop/tests/unit/dashboard-executive-360.test.ts`

## Documentation Source

- Context7 source: `/recharts/recharts`, `/sqlite/sqlite`, `/vercel/next.js`
- Official fallback source: Recharts AreaChart & ComposedChart Docs, Next.js 16 Server Actions Architecture
- Date checked: 2026-11-05

## Context

Le tableau de bord exécutif d'administration présentait plusieurs limitations et défauts visuels :
1. Une vision financière restreinte au seul chiffre d'affaires commercial, sans intégration des mouvements réels du Livre des Comptes (Recettes vs Dépenses) ni de la Trésorerie Nette.
2. L'absence de moteur de prévision d'atterrissage financier à +30 jours tenant compte des échéances de factures (nettes d'avoirs) et de la conversion pondérée du pipeline de devis.
3. Des tronquages et coupures CSS indésirables en Ligne 3 (`Top Clients` tronquant l'élément #4 SETRAG verticalement, carte de gauche vide en l'absence d'opérateurs tiers).
4. Le manque de visibilité globale sur l'état des stocks (valeur globale, alertes et ruptures) directement sur le tableau de bord.

## Decision

1. **Enrichissement de `MetricsRepository.ts` et `dashboard.actions.ts`** :
   - Ajout de `getLedgerSummary` pour agréger `totalIn` (Recettes), `totalOut` (Dépenses), `netTreasury` (`totalIn - totalOut`) et `averageMonthlyExpenses` sur base des écritures actives.
   - Ajout du moteur de prévision financière à +30 jours `getForecastMetrics` : calcul de `expectedInflows30d` (somme du reste à payer net d'avoirs des factures à échoir dans les 30 jours), `weightedQuotesPipeline` (pipeline devis pondéré à 35%), `projectedNetCash30d` (`netTreasury + expectedInflows30d + weightedQuotesPipeline - averageMonthlyExpenses`), `collectionRate` (%) et `quoteConversionRate` (%).
   - Ajout de `getStockMetrics` pour remonter `trackedCount`, `lowStockCount`, `outOfStockCount`, `totalStockValue` et le top 5 des articles sous surveillance (`lowStockItems`).
   - Ajout de `getQuotesPipelineDetails` pour synchroniser le nombre exact de devis en attente avec le badge sidebar et détailler les montants HT et TTC.
2. **Refonte de la grille de 6 Cartes KPIs Exécutives (Ligne 1)** :
   - `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4`.
   - Carte 1: CA Encaissé (montant FCFA + nb factures soldées).
   - Carte 2: Trésorerie Nette (Livre) (`netTreasury` en FCFA + détail `Entrées vs Sorties`).
   - Carte 3: Créances à Recouvrer (montant net d'avoirs + nb factures en attente).
   - Carte 4: Devis en Attente (nombre exact synchronisé avec la barre latérale + montant pipeline TTC/HT).
   - Carte 5: Valeur du Stock (montant FCFA + indicateur d'alertes / ruptures).
   - Carte 6: Prévision +30 Jours (inflows attendus + badge d'atterrissage estimé).
3. **Graphique Croisé & Ratios Clés (Ligne 2 - `DashboardRevenueChart.tsx`)** :
   - Bascule interactive entre `Flux Encaissés vs Dépenses` (Trésorerie avec courbes Recettes `#1E40AF` et Dépenses `#E11D48`) et `Revenus Facturés` (Commercial).
   - Infobulles enrichies formatées en FCFA détaillant le solde net de chaque période.
   - Carte latérale avec Donut Chart des modes de paiement et bloc visuel **Prévisions & Ratios Clés** intégrant les barres de progression du taux de recouvrement et du taux de conversion devis.
4. **Élimination des Coupures CSS & Rééquilibrage Tri-Cartes (Ligne 3)** :
   - Structure en 3 colonnes équilibrées : `Top Clients`, `État des Stocks & Alertes`, `Performance Opérateurs`.
   - Suppression des contraintes `max-h` rigides et mise en place de `h-auto min-h-[280px]` avec `space-y-3` pour garantir la lisibilité intégrale des 5 clients et articles sans coupure verticale.

## Alternatives Considered

- Calculer les prévisions côté client en React : Rejeté pour préserver la réactivité de l'application et garantir des calculs déterministes basés sur les index SQLite locaux.
- Conserver une carte opérateur prenant 2/3 de l'écran : Rejeté car elle restait désespérément vide sur les installations mono-utilisateur et comprimait les clients.

## Risks

- Performance des agrégations multi-tables :
- Mitigation : Utilisation des index composites existants (`0010_high_load_indexes.ts`) sur `tenant_id`, `deletedAt`, dates et statuts permettant une exécution sub-milliseconde.

## Verification

- Command: `npx tsc --noEmit --project apps/desktop/tsconfig.json`
- Test: `npx vitest run apps/desktop/tests/unit/dashboard-executive-360.test.ts --config apps/desktop/vitest.config.ts`
- Manual check: Navigation sur la page Tableau de Bord, alternance des périodes (30 jours, Trimestre, Année), bascule des modes de graphique et vérification de l'absence de coupure CSS sur les 5 clients.

