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
6. Blocage hors-ligne des utilisateurs Cloud sur Desktop : `syncSupabaseSession` enregistrait `password: 'supabase_session'`, empêchant toute connexion locale ultérieure en mode offline (<15ms).
7. Absence de limitation de débit sur la validation du second facteur MFA (TOTP) sur le Web Hub.

## Decision

1. **Verrouillage strict de l'onboarding** :
   - `SetupPage` et `setupApp` vérifient formellement `SetupService.isInitialized()`. Si l'application a au moins un utilisateur actif, la page redirige immédiatement vers `/login` et l'action rejette la configuration avec une erreur explicite.
   - Inversement, `LoginPage` redirige vers `/setup` si aucune initialisation n'a été effectuée.
2. **Rate-Limiter en mémoire (`checkRateLimit`, `recordFailedLogin`, `recordSuccessfulLogin`)** :
   - Verrouillage automatique de 15 minutes après 5 échecs consécutifs par identifiant.
   - Journalisation d'une alerte de sécurité d'audit `SUSPICIOUS_BRUTE_FORCE`.
   - Réinitialisation immédiate du compteur en cas d'authentification réussie.
   - Blocage immédiat sans repli Cloud sur le client Desktop si le compte est verrouillé localement.
3. **Cache local bcrypt pour utilisateurs Cloud (Offline-First)** :
   - `syncSupabaseSession` reçoit le mot de passe, génère un hash bcrypt et l'enregistre dans SQLite. Les connexions ultérieures hors-ligne s'effectuent immédiatement en local (<15ms) sans dépendance au réseau.
4. **Validation stricte du mot de passe actuel (`changeOwnPassword`)** :
   - Pour tout changement volontaire (`force_password_change === 0`), la saisie et validation du mot de passe actuel via `verifyUserPassword` sont obligatoires.
5. **Rate-Limiting MFA sur le Web Hub (`/mfa/verify`)** :
   - Compteur de tentatives consécutives échouées avec déclenchement d'un compte à rebours de suspension de 60 secondes au 5ème échec et désactivation du formulaire.
6. **Décodage UTF-8 universel** :
   - `getSession` décode le payload Base64 en UTF-8 via `Buffer`, évitant la corruption des caractères accentués français et les `SyntaxError`.
7. **Harmonisation des sessions à 7 jours** :
   - Constantes `SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60` et `SESSION_EXPIRATION_MS = SESSION_MAX_AGE_SECONDS * 1000` partagées sur toutes les actions d'authentification et cookies.
8. **Harmonisation DAL / Middleware Web-Hub** :
   - Suppression des emails codés en dur dans `dal.ts`, utilisation de `SUPERADMIN_EMAILS` avec règles strictes basées sur les rôles.

## Alternatives Considered

- Rate-limiting en base SQLite : rejeté pour les tentatives infructueuses afin d'éviter les écritures disque intensives lors d'une attaque DoS.
- Stockage en clair des sessions : rejeté au profit de hashes bcrypt salés avec 10 tours pour l'authentification hors-ligne.
- Sessions de 30 jours par défaut : jugé trop laxiste pour une application financière traitant des factures et déclarations fiscales.

## Risks

- Verrouillage légitime en cas de fautes de frappe répétées : atténué par le plafond raisonnable de 5 tentatives et la fenêtre de déverrouillage automatique de 15 minutes (Desktop) ou 60 secondes (MFA).

## Verification

- Command: `npm run quality:decisions`
- Test: Vitest Desktop (193 tests) et Web-Hub (58 tests) 100% verts
- Manual check: Tentatives répétées de connexion et tentative d'accès à `/setup` bloquées.
