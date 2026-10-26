# ADR-0025: Optimisation des Performances de Connexion et Code-Splitting Desktop

## Status

Accepted

## Scope

- Area: apps/desktop
- Library or platform: Next.js 16 (Webpack), Electron, SQLite, PowerSync
- Installed version: Next.js 16.4.3, React 19
- Related files:
  - `apps/desktop/app/login/login-client.tsx`
  - `apps/desktop/components/pages/protected-app-shell.tsx`

## Documentation Source

- Context7 source: Next.js Dynamic Imports and Route Prefetching Documentation
- Official fallback source: `node_modules/next/dist/docs/`
- Date checked: 2026-10-26

## Context

Lors de la connexion sur l'application Desktop (`/login`), la redirection vers le tableau de bord (`/`) présentait un délai excessif en environnement de développement (jusqu'à 41 secondes, dont 38,8 secondes imputables à la compilation Webpack JIT de Next.js).
Ce goulot d'étranglement découlait de quatre facteurs :
1. L'importation statique synchrone de 11 pages et sous-éditeurs lourds dans `ProtectedAppShell` (notamment `@react-pdf/renderer`, les générateurs de tableaux et modules comptables), obligeant Webpack à compiler l'arbre complet dès la première requête sur `/`.
2. L'ordre d'authentification inversé : tentative d'authentification Supabase Cloud par requête HTTPS avant le repli SQLite local, causant un aller-retour réseau et une erreur 400 inutile pour les comptes créés localement.
3. L'absence d'indication visuelle de redirection : l'état `isSubmitting` repassait à `false` dès le retour de l'action, laissant le formulaire figé pendant la navigation.
4. L'absence de préchauffage (prefetch) de la route racine `/` pendant la saisie des identifiants.

## Decision

1. **Code-Splitting par `next/dynamic`** :
   Dans `ProtectedAppShell`, le composant d'accueil `Dashboard` reste importé statiquement pour un rendu immédiat, tandis que les 10 autres vues secondaires (`InvoicesPage`, `QuotesPage`, `QuoteEditor`, `InvoiceEditor`, `ClientsPage`, `ServicesPage`, `SettingsPage`, `CreditNotesPage`, `AuditLogsPage`, `UsersPage`, `UserEditor`) sont chargées dynamiquement à la demande avec un fallback visuel `PageLoadingFallback`.
2. **Priorité Stricte Local-First** :
   Dans `login-client.tsx`, l'authentification vérifie d'abord la base SQLite locale via `loginUser` (<15ms). Si validée, la session est ouverte immédiatement et la liaison Cloud/PowerSync est déléguée de manière asynchrone non-bloquante. Le repli Cloud n'intervient que si l'utilisateur est inexistant en local.
3. **Préchauffage de Route** :
   Dès le montage de la vue de connexion, `router.prefetch("/")` initie en arrière-plan la compilation de la route racine pendant que l'utilisateur saisit son mot de passe.
4. **État de Redirection Explicite (`isRedirecting`)** :
   Le bouton et les champs affichent un état animé (*"Chargement de votre espace..."*) dès la validation des identifiants jusqu'à l'atterrissage sur le tableau de bord.

## Alternatives Considered

- Compilation statique intégrale au démarrage de Next.js : rejeté car allonge inutilement le temps de lancement de `npm run dev`.
- Navigation par rechargement complet forcé (`window.location.href`) : remplacé par `router.push("/")` avec garde-fou temporisé pour préserver le cache client.

## Risks

- Léger décalage au premier clic sur un sous-module (ex: Factures) : compensé par le fallback `PageLoadingFallback` (<300ms).
- En production (`next build`), toutes les pages sont déjà précompilées AOT, garantissant une exécution instantanée.

## Verification

- Command: `npm run quality:decisions`
- Test: `npx vitest run tests/integration/auth_logic.test.ts tests/security/auth-audit-rbac.test.ts`
- Manual check: Test de connexion avec `admin@facturier.ga` / `admin123` validé sans blocage.
