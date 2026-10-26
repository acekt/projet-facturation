# ADR-0026: Durcissement de la Sécurité d'Authentification et Rate-Limiting

## Status

Accepted

## Scope

- Area: apps/desktop, apps/web-hub
- Library or platform: Next.js 16, SQLite, Supabase Auth
- Installed version: Next.js 16.4.3, better-sqlite3 11.8.1
- Related files:
  - `apps/desktop/app/setup/page.tsx`
  - `apps/desktop/app/login/page.tsx`
  - `apps/desktop/app/actions/setup.actions.ts`
  - `apps/desktop/lib/services/SetupService.ts`
  - `apps/desktop/app/actions/auth.actions.ts`
  - `apps/desktop/lib/api/auth.ts`
  - `apps/web-hub/src/lib/auth/dal.ts`
  - `apps/web-hub/src/utils/supabase/middleware.ts`

## Documentation Source

- Context7 source: OWASP Authentication Cheat Sheet & Next.js Security Best Practices
- Official fallback source: `node_modules/next/dist/docs/`
- Date checked: 2026-10-26

## Context

L'audit de sécurité des flux d'authentification a révélé des vulnérabilités et parasites de niveau P0/P1 :
1. Faille critique sur l'onboarding : `/setup` et `setupApp` ne vérifiaient pas `SetupService.isInitialized()`, permettant d'écraser le mot de passe administrateur après la mise en production.
2. Absence de limitation de débit (Brute-Force & DoS) : aucune protection contre les attaques par dictionnaire répétées sur l'action `loginUser`.
3. Décodage de session corrompant les caractères UTF-8 : l'utilisation d'`atob` dans `lib/api/auth.ts` au lieu de `Buffer.from(..., 'base64').toString('utf8')`.
4. Incohérence des durées de vie de session : dispersion entre 24h et 30 jours selon le type de connexion.
5. Incohérence des filtres de rôles Superadmin entre `dal.ts` et `middleware.ts` dans le Web Hub.

## Decision

1. **Verrouillage strict de l'onboarding** :
   - `SetupPage` et `setupApp` vérifient formellement `SetupService.isInitialized()`. Si l'application a au moins un utilisateur actif, la page redirige immédiatement vers `/login` et l'action rejette la configuration avec une erreur explicite.
   - Inversement, `LoginPage` redirige vers `/setup` si aucune initialisation n'a été effectuée.
2. **Rate-Limiter en mémoire (`checkRateLimit`, `recordFailedLogin`, `recordSuccessfulLogin`)** :
   - Verrouillage automatique de 15 minutes après 5 échecs consécutifs par identifiant.
   - Réinitialisation immédiate du compteur en cas d'authentification réussie.
3. **Décodage UTF-8 universel** :
   - `getSession` décode le payload Base64 en UTF-8 via `Buffer`, évitant la corruption des caractères accentués français et les `SyntaxError`.
4. **Harmonisation des sessions à 7 jours** :
   - Constantes `SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60` et `SESSION_EXPIRATION_MS = SESSION_MAX_AGE_SECONDS * 1000` partagées sur toutes les actions d'authentification et cookies.
5. **Harmonisation DAL / Middleware Web-Hub** :
   - Suppression des emails codés en dur dans `dal.ts`, utilisation de `SUPERADMIN_EMAILS` avec règles strictes basées sur les rôles.

## Alternatives Considered

- Rate-limiting en base SQLite : rejeté pour les tentatives infructueuses afin d'éviter les écritures disque intensives lors d'une attaque DoS.
- Sessions de 30 jours par défaut : jugé trop laxiste pour une application financière traitant des factures et déclarations fiscales.

## Risks

- Verrouillage légitime en cas de fautes de frappe répétées : atténué par le plafond raisonnable de 5 tentatives et la fenêtre de déverrouillage automatique de 15 minutes.

## Verification

- Command: `npm run quality:decisions`
- Test: Vitest Desktop (193 tests) et Web-Hub (58 tests) 100% verts
- Manual check: Tentatives répétées de connexion et tentative d'accès à `/setup` bloquées.
