# ADR-0009: Socle UI du Hub Web, Composants Graphiques Recharts et Coque Streaming

## Status

Accepted

## Scope

- Area: Hub Web / Design System / Composants Graphiques / Navigation
- Library or platform: Next.js 16 App Router, Recharts 2.15, Tailwind CSS 4, React 19
- Installed version: recharts 2.15.0, next 16.4.0, react 19.3.0
- Related files: `packages/ui/src/components/chart.tsx`, `packages/ui/src/components/kpi-card.tsx`, `apps/web-hub/src/app/admin/layout.tsx`, `apps/web-hub/src/app/admin/page.tsx`, `apps/web-hub/src/components/admin/sidebar.tsx`, `apps/web-hub/src/components/admin/overview-charts.tsx`

## Documentation Source

- Context7 source: `/recharts/recharts` (ResponsiveContainer, AreaChart, BarChart, Tooltip), Next.js 16 docs (Suspense streaming, App Router layout)
- Official fallback source: documentation officielle Recharts & Next.js
- Date checked: 2026-10-20

## Context

Le Hub Web nécessite un socle UI de niveau entreprise pour offrir une vue d'ensemble instantanée des métriques multi-tenant, sans compromettre la sécurité ni la réactivité. L'intégration de graphiques responsives et accessibles, de cartes KPI enrichies (avec mini-courbes sparklines et indicateurs de delta), ainsi qu'une navigation modulaire par onglets (`/admin/**`) est indispensable avant d'attaquer la gestion unitaire des tenants (Phase H3).

## Decision

1. **Composants graphiques accessibles dans `@workspace/ui`** :
   Création de `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend` et `ChartLegendContent` enveloppant Recharts. Injection des variables CSS thématiques (`--color-*`) pour une cohérence chromatique totale avec le thème sombre Tailwind 4.
2. **Composant KPI riche (`KpiCard`)** :
   Développement d'un composant autonome supportant des sparklines SVG vectorielles ultra-légères (zéro dépendance lourde), badges de statut, deltas comparatifs et palettes sémantiques (indigo, émeraude, rose, ambre, bleu).
3. **Architecture de navigation modulaire (`/admin/**`)** :
   Mise en place d'un layout persistant [layout.tsx](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/apps/web-hub/src/app/admin/layout.tsx) avec barre latérale contextuelle [sidebar.tsx](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/apps/web-hub/src/components/admin/sidebar.tsx) : détection active de l'onglet courant (`usePathname`), badge de sécurité AAL2 en direct, en-tête avec barre de recherche et indicateur de santé système.
4. **Coque de rendu en streaming Suspense** :
   Découplage de la coque applicative et du chargement asynchrone des métriques lourdes via `<Suspense fallback={...}>` dans [page.tsx](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/apps/web-hub/src/app/admin/page.tsx) pour garantir un premier affichage instantané.

## Alternatives Considered

- Utiliser Chart.js ou ApexCharts : rejeté car Recharts s'intègre nativement avec l'arbre de composants React et les styles Tailwind, tout en étant déjà disponible dans les dépendances.
- Charger l'ensemble des données de manière bloquante dans le layout : rejeté car cela retarderait l'affichage du premier octet (TTFB) ; le streaming avec Suspense garantit un affichage instantané du shell.

## Risks

- Les conteneurs Recharts (`ResponsiveContainer`) requièrent un conteneur parent à hauteur définie ou ratio d'aspect pour éviter tout saut de mise en page (CLS) au montage côté client.

## Verification

- Command: `npm run quality:decisions`
- Test: Validation du typecheck Turborepo et exécution des suites de tests web-hub
- Manual check: Navigation sur `/admin` avec rendu des cartes KPI et graphiques interactifs
