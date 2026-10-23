# ADR-0016: Unification du Layout Administrateur Hub et Alignement du Rendu Dynamique Next.js 16

## Status

Accepted

## Scope

- Area: Hub Web Super Admin / Architecture du Layout / Alignement Visuel / Next.js 16 App Router
- Library or platform: Next.js 16.4 App Router (`instant = false`, `connection()`, layout unique), Tailwind CSS v4, Recharts
- Installed version: next 16.4.0, react 19.3.0, @workspace/ui 1.0.0
- Related files: `apps/web-hub/src/app/admin/layout.tsx`, `apps/web-hub/src/components/admin/admin-shell.tsx`, `apps/web-hub/src/components/admin/header.tsx`, `apps/web-hub/src/app/admin/**/page.tsx`, `apps/web-hub/src/components/admin/overview-charts.tsx`

## Documentation Source

- Context7 source: `/vercel/next.js` (App Router layouts, dynamic prerendering with `export const instant = false;` and `connection()`)
- Official fallback source: Documentation officielle Next.js 16 `blocking-prerender-dynamic`
- Date checked: 2026-10-21

## Context

Deux anomalies majeures ont été identifiées dans le module d'administration du Hub :
1. **Divergence de Layout** : L'existence historique de deux structures d'en-tête et de mise en page concurrentes (`AdminShell` d'un côté avec gestion mobile / desktop rétractable, et un layout inline incomplet dans `admin/layout.tsx`) créait des ruptures visuelles, des bannières désalignées d'une page à l'autre, et une barre latérale intrusive sur mobile.
2. **Avertissements & Erreurs de Rendu Next.js 16** :
   - Next.js 16 lève l'erreur critique `blocking-prerender-dynamic` sur les routes utilisant `connection()` ou requêtant Supabase hors cache lorsque la route n'est pas déclarée avec `export const instant = false;`.
   - Recharts émettait des avertissements en console (`The width(0) and height(0) of chart should be greater than 0...`) causés par le manque de `min-w-0` dans les grilles flex/grid parentes.

## Decision

1. **Layout Unique et Centralisé (`AdminShell`)** :
   - Consolidation de `apps/web-hub/src/app/admin/layout.tsx` pour déléguer l'ensemble de la structure à un `AdminShell` unique.
   - Intégration de `MobileNav` pour smartphone, `CollapsibleSidebar` (72px / 256px) pour desktop, et `AdminHeader` unifié (fil d'Ariane, commande ⌘K, indicateur de synchronisation, badge de sécurité tenant, sélecteur de thème, profil Super Admin avec déconnexion).
   - Centrage strict de toutes les pages enfants dans un conteneur standardisé `<main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-background transition-colors focus:outline-none"><div className="w-full max-w-7xl mx-auto space-y-6">`.
2. **Harmonisation Visuelle des En-têtes de Page** :
   - Remplacement des titres flottants par des cartes d'en-tête standardisées (`p-6 rounded-2xl bg-card border border-border shadow-xs`) sur toutes les pages (`/admin`, `/admin/tenants`, `/admin/tenants/[id]`, `/admin/sync`, `/admin/finance`, `/admin/adoption`, `/admin/security`, `/admin/licences`, `/admin/announcements`).
3. **Résolution Next.js 16 & Recharts** :
   - Ajout explicite de `export const instant = false;` sur toutes les routes serveur dynamiques du Hub.
   - Ajout de `min-w-0` et `aspect-auto` sur les conteneurs de graphiques Recharts pour éviter toute instabilité de dimensionnement.

## Alternatives Considered

- Maintenir deux variantes de layout (complet vs compact) : Rejeté car source de duplications, d'incohérences de marge et de rupture d'expérience utilisateur.
- Forcer le rendu statique avec `generateStaticParams` : Rejeté car les métriques multi-tenant du Hub doivent refléter la télémétrie en temps réel de Supabase et PowerSync.

## Risks

- Régression sur les tests unitaires existants : Évitée en conservant l'exacte signature des exports et composants requis par la suite de tests (`AdminHeader`, `AdminShell`, `MobileNav`, `CollapsibleSidebar`).

## Verification

- Command: `npm run quality:decisions` et `npm run test` dans `apps/web-hub`.
- Test: 48 tests Vitest validés avec succès à 100%.
- Manual check: Contrôle du rendu responsive, de la fluidité de la sidebar rétractable et de l'alignement sur `http://localhost:3001/admin`.
