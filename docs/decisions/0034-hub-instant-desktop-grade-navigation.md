# ADR-0034: Hub Instant Desktop-Grade Navigation and Route Transition Architecture

## Status

Accepted

## Scope

- Area: Hub Cloud Navigation, Route Transitions, Prefetching, Optimistic Active States, Top Progress Feedback
- Library or platform: Next.js 16 App Router, Turbopack, Tailwind CSS, React 19
- Installed version: next 16.4.3, react 19.3.0
- Related files:
  - `apps/desktop/components/pages/protected-app-shell.tsx`
  - `apps/web-hub/src/app/admin/template.tsx`
  - `apps/web-hub/src/components/admin/navigation-progress.tsx`
  - `apps/web-hub/src/components/admin/collapsible-sidebar.tsx`
  - `apps/web-hub/src/components/admin/mobile-nav.tsx`
  - `apps/web-hub/src/components/admin/sidebar.tsx`
  - `apps/web-hub/src/components/admin/command-palette.tsx`
  - `apps/web-hub/src/components/admin/admin-shell.tsx`
  - `apps/web-hub/src/app/globals.css`

## Documentation Source

- Context7 source: `/vercel/next.js` (App Router `template.tsx`, `<Link prefetch>`, Partial Prefetching, navigation transitions)
- Official fallback source: `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`
- Date checked: 2026-10-28

## Context

L'application Desktop (`apps/desktop`) offre une expérience utilisateur ultra-fluide et instantanée caractérisée par :
1. **Une architecture d'état en mémoire vive (SPA)** : Dans `ProtectedAppShell`, le changement de page s'effectue via `React.startTransition(() => setCurrentPage(page))` sans requête réseau ni rechargement de document HTML.
2. **Une transition micro-animée à 60fps** : Un wrapper `AnimatePresence` + `motion.div` (`pageVariants: opacity 0 -> 1, translateY 10 -> 0`) masque tout temps de rendu et donne une sensation d'application native.
3. **Un retour tactile immédiat (0 ms)** : Le bouton de navigation actif s'illumine instantanément dès la pression du pointeur.

À l'inverse, sur le Hub Cloud (`apps/web-hub`), la navigation repose sur le modèle distribué Next.js 16 App Router (RSC streamés depuis Vercel et requêtes PostgreSQL Supabase Cloud). Par défaut :
- Le survol et l'affichage des liens dans la barre latérale ne préchargeaient pas systématiquement l'arborescence complète (`prefetch` par défaut).
- L'indicateur d'onglet actif dépendait strictement de `pathname`, provoquant une latence perçue de 200 à 500 ms avant que le menu ne réagisse visuellement.
- L'absence d'enveloppe de transition `template.tsx` causait des ruptures visuelles sèches lors du remplacement des vues.
- L'utilisateur ne recevait aucun indicateur tactile de progression pendant le trajet réseau.

## Decision

Pour conférer au Hub Cloud le même niveau de fluidité et de réactivité instantanée que l'application Desktop, nous mettons en œuvre les cinq piliers techniques suivants :

1. **Enveloppe de Transition de Route (`apps/web-hub/src/app/admin/template.tsx`)** :
   - Contrairement à `layout.tsx` qui persiste, `template.tsx` remonte à chaque changement d'URL.
   - Application d'une animation accélérée par GPU (`.animate-page-enter` : `translateY(8px)` -> `translateY(0)` et `opacity: 0 -> 1` en 220 ms avec courbe de Bézier ergonomique `cubic-bezier(0.16, 1, 0.3, 1)`).

2. **État de Navigation Optimiste (0 ms)** :
   - Dans `CollapsibleSidebar` et `MobileNav`, introduction d'un état `optimisticPath` capturé dès l'événement `onMouseDown` ou `onClick`.
   - L'onglet cliqué s'illumine instantanément (< 1 ms), synchronisé et réinitialisé automatiquement dès que `pathname` confirme l'arrivée.

3. **Préchargement Proactif (`prefetch={true}`)** :
   - Activation explicite de `prefetch={true}` sur l'ensemble des liens de la barre latérale rétractable, du tiroir mobile et du menu général.
   - En synergie avec `partialPrefetching: true` de Next.js 16, le shell statique et les caches de route sont pré-téléchargés en tâche de fond dès l'apparition du menu.

4. **Barre de Progression Tactile Instantanée (`NavigationProgressBar`)** :
   - Intégration d'un indicateur de 2,5 px au sommet de l'écran (`bg-gradient-to-r from-primary via-accent to-primary`) s'animant immédiatement lors d'un clic sur un lien interne, confirmant instantanément la prise en compte de l'action utilisateur.

5. **Préchargement dans la Palette de Commande (`CommandPalette`)** :
   - Déclenchement de `router.prefetch(target.href)` dès que l'utilisateur sélectionne un module au clavier (flèches haut/bas), garantissant un affichage instantané lors de l'appui sur Entrée.

## Alternatives Considered

- Alternative 1 : Remplacer toutes les routes App Router du Web Hub par un composant monolithique avec onglets en état client — Rejeté car cela détruirait le routage d'URL profonds (`/admin/tenants/[id]`, `/admin/finance`, etc.), le SEO administratif, le partage de liens directs et le Partial Prerendering serveur.
- Alternative 2 : Importer la bibliothèque lourde `framer-motion` côté client pour animer le layout — Rejeté au profit de classes CSS accélérées par GPU (`will-change: opacity, transform`) garantissant 0 Ko de surcoût JavaScript et 60fps constants même sur mobile.

## Risks

- Risk: Préchargement excessif de bande passante si de nombreux liens sont présents dans la page.
- Mitigation: La liste de navigation administrative est bornée (10 modules métiers) et bénéficie du cache client Next.js 16 avec durée de vie optimisée.

## Verification

- Command: `npm run build --workspace=web-hub` (compilation des 19 routes et du template)
- Command: `npm run quality:decisions` (validation formelle des 34 ADRs)
- Test manuel : Clic sur les onglets du Hub (`/admin/tenants`, `/admin/sync`, etc.) avec illumination immédiate de l'onglet et transition fluide sans à-coup.
