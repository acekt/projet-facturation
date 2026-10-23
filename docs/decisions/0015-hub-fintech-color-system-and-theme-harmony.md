# ADR-0015: Harmonisation Visuelle, Palette de Couleurs Fintech et Cohérence Light/Dark Web Hub

## Status

Accepted

## Scope

- Area: Hub Web Super Admin / Thème / Cohérence Design System / Accessibilité Visuelle
- Library or platform: Tailwind CSS v4, Next-Themes, Packages/UI Design System Tokens
- Installed version: next 16.4.0, next-themes 0.4.6, @workspace/ui 1.0.0
- Related files: `packages/ui/src/styles/theme.css`, `apps/web-hub/src/app/globals.css`, `apps/web-hub/src/components/admin/*`, `apps/web-hub/src/app/admin/*`, `apps/web-hub/src/app/mfa/*`

## Documentation Source

- Context7 source: `/shadcn/ui`, `/tailwindlabs/tailwindcss` (Tailwind CSS v4 CSS variables & design tokens)
- Official fallback source: Documentation de conception de la suite Fintech Facturier (`packages/ui/src/styles/theme.css`)
- Date checked: 2026-10-21

## Context

L'application Web Hub présentait un mélange hétérogène de classes CSS arbitraires (`slate-*`, `neutral-*`, `indigo-*`, `sky-*`, arrière-plans sombres codés en dur) créant une discordance visuelle majeure :
1. En mode clair, de nombreux éléments présentaient un contraste déficient (textes gris clairs illisibles sur fond blanc, boutons aux teintes non coordonnées).
2. L'identité graphique du produit était fragmentée entre le client Desktop (Bleu Institutionnel `#003399` et Vert Dynamique `#2CA02C`) et le Hub Web qui utilisait des palettes génériques (`indigo-600`, `slate-950`).
3. Les écrans critiques d'authentification et de sécurité (connexion, double facteur MFA, erreurs 401 et 403) imposaient des fonds noirs fixes non commutables.

## Decision

1. **Adoption intégrale des tokens sémantiques Fintech du package partagé** :
   - Élimination de 100% des classes arbitraires (`slate-*`, `neutral-*`, `indigo-*`, `sky-*`) dans l'ensemble de `apps/web-hub/src`.
   - Utilisation systématique des tokens officiels : `--primary` (`#003399`), `--accent` (`#2CA02C`), `--background`, `--foreground`, `--card`, `--border`, `--muted`, `--secondary`, `--destructive`.
2. **Support universel et harmonieux Light / Dark Mode** :
   - Synchronisation complète avec `next-themes` via le sélecteur `ThemeToggle`.
   - Tous les conteneurs et coquilles d'application (`AdminShell`, `AdminHeader`, `MobileNav`, `CollapsibleSidebar`) basculent instantanément et de façon fluide entre les modes clair (`#fafafa`) et sombre (`#030303`).
3. **Graphiques Recharts et Télémétrie Alignés** :
   - Harmonisation des séries temporelles et visualisations financières : facturé en Bleu Institutionnel (`#003399`) et payé/recouvert en Vert Dynamique (`#2CA02C`).
4. **Préservation stricte des signatures et tests de résilience** :
   - Tous les composants conservent leurs props et exports contractuels, validés par la suite de tests Vitest (48/48 tests réussis).

## Alternatives Considered

- Maintenir une palette indigo dédiée au Web : rejeté pour garantir une expérience de marque institutionnelle unifiée entre les solutions desktop et cloud du facturier.
- Forcer un mode sombre exclusif : rejeté car de nombreux opérateurs comptables et financiers travaillent en environnement bureautique éclairé exigeant un mode clair de haute lisibilité.

## Risks

- Régression sur les composants de navigation ou les graphiques : prévenu par des tests unitaires complets et l'inspection visuelle via subagent de navigation en mode clair et sombre.

## Verification

- Command: `npm run quality:decisions` et `npm run test` dans `apps/web-hub`
- Test: 48 tests Vitest validés avec succès sur l'ensemble des modules Web Hub.
- Manual check: Validation visuelle par captures d'écran des modes clair et sombre sur `http://localhost:3001`.
