# ADR-0027: Rationalisation UI/UX du Module d'Authentification et Suppression des Parasites

## Status

Accepted

## Scope

- Area: apps/desktop, apps/web-hub
- Library or platform: Next.js 16, React 19, Lucide React, TailwindCSS, Supabase Auth
- Installed version: Next.js 16.4.3, React 19.2.0
- Related files:
  - `apps/desktop/app/login/login-client.tsx`
  - `apps/desktop/components/auth/force-password-change-dialog.tsx`
  - `apps/desktop/lib/validations.ts`
  - `apps/desktop/app/setup/setup-client.tsx`
  - `apps/web-hub/src/app/login/page.tsx`
  - `apps/web-hub/src/app/login/login-form.tsx`
  - `apps/web-hub/src/app/login/actions.ts`
  - `apps/web-hub/src/app/mfa/enroll/page.tsx`

## Documentation Source

- Context7 source: Nielsen Norman Group Form Usability Best Practices & WCAG 2.2 Guidelines
- Official fallback source: `node_modules/next/dist/docs/`
- Date checked: 2026-10-27

## Context

L'audit de l'expérience utilisateur (UX) et des interfaces graphiques (UI) du module d'authentification a mis en évidence plusieurs anomalies et parasites :
1. Présence d'un bouton parasite *"Configurer mon entreprise (Setup)"* sur la page de connexion Desktop alors que l'application est déjà initialisée (provoquant des redirections circulaires stériles).
2. Absence d'indicateur de chargement (`Loader2`) lors de la soumission du formulaire sur le Web Hub, induisant des clics multiples et de la frustration.
3. Absence de bouton pour afficher/masquer les mots de passe complexes sur le Web Hub, provoquant des fautes de frappe invisibles.
4. Messages d'erreurs d'authentification bruts en anglais dans le Web Hub (`Invalid login credentials`) polluant durablement l'URL (`?message=...`).
5. Absence de bascule de thème (`ThemeToggle`) sur le Login Desktop, empêchant l'adaptation au confort visuel des utilisateurs avant la connexion.
6. Validation client prématurée dans la modale de changement de mot de passe (`ForcePasswordChangeDialog`), permettant de cliquer avec le champ mot de passe actuel vide.
7. Incohérence des exigences de robustesse de mot de passe entre le Setup (6 car.) et le reste de l'application (8 car. + majuscule + minuscule + chiffre).

## Decision

1. **Suppression des parasites et clarté sur Desktop** :
   - Élimination définitive du bloc et bouton Setup sur la page de connexion de l'application configurée.
   - Ajout d'une notice explicative pour les comptes locaux dans le flux de réinitialisation ("Mot de passe oublié ?").
   - Intégration du composant `ThemeToggle` discret en haut à droite du Login Desktop.
   - Ajout de l'icône `Eye` pour basculer la visibilité du mot de passe et des attributs `autoComplete="username"` et `autoComplete="current-password"`.
2. **Refonte interactive du Login Web Hub** :
   - Extraction d'un composant client `LoginForm` gérant l'état de soumission avec un indicateur animé `Loader2` et le blocage des multi-clics.
   - Ajout du basculeur de visibilité de mot de passe (`Eye` / `EyeOff`).
   - Traduction centralisée de toutes les erreurs Supabase en français naturel et nettoyage automatique du query param via `replaceState`.
3. **Harmonisation des exigences de mot de passe** :
   - Mise à niveau d'`adminSetupSchema` et du Setup Wizard pour exiger 8 caractères avec majuscule, minuscule et chiffre dès le premier démarrage.
4. **Validation client stricte dans la modale de mot de passe** :
   - Conditionnement de l'activation du bouton à la saisie effective du mot de passe actuel lors des changements volontaires.
5. **Guidage pas-à-pas pour l'enrôlement MFA** :
   - Découpage visuel clair en 2 étapes (① Scan du QR Code / Saisie clé, ② Validation du code 6 chiffres) avec bordure de contraste optimisée pour les modes clair et sombre.

## Risks

- Exigence renforcée sur le mot de passe initial du Setup : atténuée par les indicateurs d'aide visuels en temps réel et la politique commune déjà active sur les comptes utilisateurs.

## Verification

- Command: `npm run quality:decisions`
- Test: Vitest Desktop et Web-Hub 100% verts
- Manual check: Feedback visuel immédiat (<100ms) et aucune persistance d'erreur d'URL.
