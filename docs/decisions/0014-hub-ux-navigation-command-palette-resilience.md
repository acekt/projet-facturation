# ADR-0014: Excellence UX/UI du Hub Web, Navigation Réactive, Palette de Commande et Résilience App Router

## Status

Accepted

## Scope

- Area: Hub Web Super Admin / Ergonomie UX / Responsive Mobile / Command Palette ⌘K / Gestion d'Erreurs Next.js 16
- Library or platform: Next.js 16.4 App Router (loading.tsx, error.tsx, not-found.tsx), React 19 Client/Server Components, Tailwind CSS v4
- Installed version: next 16.4.0, react 19.3.0, @workspace/ui 1.0.0, lucide-react 0.564.0
- Related files: `apps/web-hub/src/app/admin/layout.tsx`, `apps/web-hub/src/app/admin/loading.tsx`, `apps/web-hub/src/app/admin/error.tsx`, `apps/web-hub/src/app/admin/not-found.tsx`, `apps/web-hub/src/components/admin/command-palette.tsx`, `apps/web-hub/src/components/admin/breadcrumb.tsx`, `apps/web-hub/src/components/admin/mobile-nav.tsx`

## Documentation Source

- Context7 source: `/vercel/next.js` (App Router loading.js, error.js boundary, streaming Suspense, accessible navigation)
- Official fallback source: Documentation officielle Next.js 16 Error Handling & Loading UI
- Date checked: 2026-10-21

## Context

L'espace Hub Super Admin est l'outil central de pilotage de la plateforme financière. Son utilisation quotidienne par les opérateurs exige :
1. **Une navigation fluide et réactive** : aussi bien sur écrans larges que sur tablettes et smartphones lors d'interventions en mobilité.
2. **Un accès instantané aux fonctions critiques** : via une palette de commande globale au clavier (`⌘K` / `Ctrl+K`) permettant de chercher et naviguer sans quitter les mains du clavier.
3. **Une résilience irréprochable** : en cas d'indisponibilité momentanée du réseau ou d'une requête Supabase, l'application ne doit pas afficher une page blanche mais capturer l'erreur localement avec une option de réessai immédiat (`error.tsx`), et afficher des squelettes visuels soignés pendant le streaming des données (`loading.tsx`).
4. **Une clarté d'orientation spatiale** : via un fil d'Ariane dynamique (Breadcrumb) guidant l'administrateur dans l'arborescence profonde.

## Decision

1. **Architecture de Navigation Responsive & Mobile Drawer** :
   - Mise en place d'un composant de navigation mobile dédié avec tiroir coulissant et backdrop flouté.
   - Préservation de la barre latérale sur desktop avec état actif explicite, badges de surveillance en direct et raccourcis d'accessibilité.
2. **Palette de Commande Interactive Globale (`⌘K`)** :
   - Implémentation d'un composant modal accessible avec écoute des raccourcis clavier universels (`⌘K` et `Ctrl+K`, `Échap`, flèches directionnelles).
   - Indexation immédiate de l'intégralité des 8 modules du Hub, des actions Super Admin (bris de glace, diffusion d'annonces, quotas, exports CSV) et navigation directe.
3. **Résilience et Gestion d'Erreurs Segmentée Next.js 16** :
   - Implémentation de `apps/web-hub/src/app/admin/loading.tsx` avec un layout de squelettes animé et tokens visuels Dark SaaS.
   - Implémentation de `apps/web-hub/src/app/admin/error.tsx` (Client Component) avec capture de `digest`, bouton `reset()` et lien de repli sécurisé.
   - Implémentation de `apps/web-hub/src/app/admin/not-found.tsx` personnalisé avec redirection et guidage utilisateur.
4. **Fil d'Ariane Contextuel & Toasting Intégré** :
   - Ajout d'un fil d'Ariane réactif analysant le `pathname`.
   - Système de notification toast sans dépendance lourde externe pour le retour d'information utilisateur immédiat.

## Alternatives Considered

- Laisser la barre de recherche en `readOnly` statique : rejeté car décevant pour l'expérience utilisateur et non conforme aux exigences d'ergonomie SaaS moderne.
- Utiliser une bibliothèque tierce volumineuse pour la palette de commande : rejeté pour garantir une performance maximale sans alourdir le bundle client Turbopack.

## Risks

- Conflit d'écouteurs de touches pour `⌘K` : prévenu par vérification de la cible active (ignorer si l'utilisateur saisit déjà dans un `textarea` ou formulaire modal).

## Verification

- Command: `npm run quality:decisions`
- Test: Vitest suite dans `apps/web-hub/tests/` et validation du typage strict avec `npx turbo run typecheck`.
- Manual check: Test d'ouverture au clavier `⌘K`, navigation mobile, et rendu des états d'erreur et de chargement.
