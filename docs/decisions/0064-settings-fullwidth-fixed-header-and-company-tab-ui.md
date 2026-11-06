# ADR-0064: Settings Fullwidth Layout, Fixed Header Navigation and Company Tab Design System

## Status

Accepted

## Scope

- Area: Settings Page, Fixed Header Layout, Design System Harmonization, Company Logo Preview
- Library or platform: Next.js 16, React 19, Tailwind CSS, Shadcn/Radix UI Tabs
- Installed version: next 16.0.0, react 19.0.0, @radix-ui/react-tabs ^1.1.1
- Related files:
  - `apps/desktop/components/pages/settings.tsx`
  - `apps/desktop/components/features/settings/CompanySettingsTab.tsx`
  - `apps/desktop/tests/unit/settings-layout-and-company-tab.test.tsx`

## Documentation Source

- Context7 source: `/vercel/next.js`, `/radix-ui/primitives`
- Official fallback source: Radix UI Tabs Accessibility & Component Architecture, Tailwind CSS Layouts
- Date checked: 2026-11-05

## Context

Dans le module des Paramètres de l'application :
1. La page `settings.tsx` utilisait un conteneur rigide `max-w-4xl` avec une barre de défilement interne flottant au milieu de l'écran, laissant un grand espace blanc inexploité à droite sur les résolutions de bureau.
2. L'en-tête de la page (titre, bouton `Enregistrer (Ctrl+S)` et barre d'onglets) défilait avec le contenu et disparaissait dès que l'utilisateur descendait dans les formulaires, forçant à remonter tout en haut pour changer d'onglet ou sauvegarder.
3. Dans `CompanySettingsTab.tsx` :
   - Le bouton "Tester la connexion" SMTP utilisait une icône verte avec la classe `text-emerald-600` non standardisée.
   - Les champs SMTP affichaient des placeholders de type `"ex: ..."` au lieu de directives utilisateur formelles.
   - Le cadre de logo restait vide avec un visuel de placeholder tant qu'aucun logo personnalisé n'avait été uploadé, au lieu de mettre en valeur l'identité par défaut de l'entreprise (`/logo.png`).

## Decision

1. **Architecture de Mise en Page Pleine Largeur & En-tête Fixe (`settings.tsx`)** :
   - Suppression du `max-w-4xl` pour utiliser la pleine largeur de l'écran.
   - En-tête fixe supérieur (`shrink-0 pb-4 border-b border-border`) regroupant le titre, le bouton primaire `Enregistrer (Ctrl+S)` et la barre d'onglets (`TabsList`). L'en-tête demeure ainsi visible en permanence au cours de la saisie.
   - Zone de contenu scrollable indépendante sur toute la largeur (`flex-1 overflow-y-auto min-h-0 pt-6 pr-2 pb-6`).
2. **Grille Équilibrée & Intégration SMTP (`CompanySettingsTab.tsx`)** :
   - Mise en place d'une grille réactive `grid grid-cols-1 xl:grid-cols-12 gap-6 items-start`.
   - "Identité de l'entreprise" occupe `xl:col-span-7` et "Configuration d'envoi Email (SMTP)" occupe `xl:col-span-5`, assurant un remplissage harmonieux et équilibré de l'espace.
3. **Harmonisation UI & Aperçu Logo Par Défaut** :
   - Si `formData.logo` est vide, aperçu automatique de `/logo.png` avec badge "Logo par défaut" et overlay interactif "Modifier le logo" au survol pour les administrateurs.
   - Standardisation des placeholders sans `"ex:"` : `"Entrez l'hôte du serveur SMTP"`, `"Entrez l'adresse email d'expédition"`, `"Entrez le port SMTP"`.
   - Bouton `"Tester la connexion"` aligné sur le Design System universel avec `<CheckCircle2 className="w-4 h-4" />` sans `text-emerald-*`.

## Alternatives Considered

- Laisser les onglets défiler avec le formulaire : Rejeté pour des raisons d'ergonomie et d'alignement avec les autres pages (Factures, Devis, Avoirs) qui disposent toutes d'en-têtes fixes.
- Conserver un affichage plein écran empilé pour les paramètres SMTP : Rejeté car cela créait des kilomètres de défilement vertical vide sur grand écran.

## Risks

- Comportement responsive sur petits écrans (tablette / mobile) :
- Mitigation : Utilisation de `grid-cols-1` par défaut et déclenchement de la grille à deux colonnes uniquement à partir du breakpoint `xl:`.

## Verification

- Command: `npx tsc --noEmit --project apps/desktop/tsconfig.json`
- Test: `npx vitest run apps/desktop/tests/unit/settings-layout-and-company-tab.test.tsx --config apps/desktop/vitest.config.ts`
- Decision Check: `npm run quality:decisions`
- Manual check: Consultation de la page Paramètres, vérification du maintien de l'en-tête lors du défilement, affichage de `/logo.png` et disposition côte à côte sur écran large.

