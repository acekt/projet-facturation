# ADR-0007: Sécurité du Hub Web, MFA TOTP (AAL2) et Autorisation Multi-Tenant

## Status

Accepted

## Scope

- Area: Hub Web / Sécurité d'accès / Supabase Auth / MFA / Audit
- Library or platform: Supabase Auth, Next.js 16 SSR, PostgreSQL RLS
- Installed version: @supabase/ssr 0.12.7, @supabase/supabase-js 2.117.3, next 16.4.0
- Related files: `supabase/migrations/20261020_hub_security.sql`, `apps/web-hub/src/proxy.ts`, `apps/web-hub/src/utils/supabase/middleware.ts`, `apps/web-hub/src/lib/auth/dal.ts`, `apps/web-hub/src/lib/audit.ts`, `apps/web-hub/src/app/mfa/**`

## Documentation Source

- Context7 source: `/supabase/supabase` (Custom Access Token Hook `custom_access_token_hook(event jsonb)` & TOTP MFA `getAuthenticatorAssuranceLevel`, `challengeAndVerify`), Next.js 16 docs (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/forbidden.md`, `unauthorized.md`)
- Official fallback source: documentation officielle Supabase Auth & Next.js 16
- Date checked: 2026-10-20

## Context

Le Hub Web (`apps/web-hub`) constitue le centre névralgique du SaaS Hub & Spoke. Il permet de superviser tous les tenants, d'inspecter les métriques financières et de synchronisation, d'exécuter des suspensions de clients ou de réaliser des accès exceptionnels de support (« bris de glace »).
À ce stade, `apps/web-hub/src/proxy.ts` et `src/utils/supabase/middleware.ts` se contentaient de vérifier l'existence d'une session sans contrôler le rôle de l'utilisateur ni exiger de second facteur d'authentification (MFA). Tout utilisateur de tenant pouvait donc potentiellement naviguer sur le Hub s'il disposait d'un compte valide. De plus, aucune table d'audit inviolable (`hub_audit_logs`) n'enregistrait les opérations sensibles d'administration globale, et les claims JWT standard n'embarquaient pas le rôle `user_role` de manière sécurisée.

## Decision

1. **Hook JWT Supabase (`custom_access_token_hook`)** :
   Définition d'une fonction PostgreSQL `security definer` injectant de manière infalsifiable le claim `user_role` dans les jetons JWT émis par Supabase Auth. Les privilèges d'exécution sont exclusivement accordés à `supabase_auth_admin` avec révocation pour `public`, `anon` et `authenticated`.
2. **MFA TOTP obligatoire et vérification AAL2** :
   Contrôle de l'authenticator assurance level (`getAuthenticatorAssuranceLevel`). Si un second facteur TOTP est enrôlé, l'accès aux sections administratives requiert impérativement `aal2`. Mise en place d'une politique RLS restrictive PostgreSQL (`as restrictive to authenticated using ((select auth.jwt()->>'aal') = 'aal2')`) sur les ressources sensibles du Hub.
3. **Défense en profondeur à 3 niveaux** :
   - *Niveau 1 (Edge / Proxy Next.js)* : `proxy.ts` et `middleware.ts` interceptent toute requête hors `/login`, `/auth` et `/mfa`. Les utilisateurs non-authentifiés sont redirigés vers `/login`. Les utilisateurs sans rôle `superadmin` sont rejetés (`403` / redirection `/login?error=forbidden`). Les superadmins avec facteur non encore validé (`aal1` vs `nextLevel: aal2`) sont redirigés vers `/mfa/verify`.
   - *Niveau 2 (Data Access Layer - DAL)* : `requireSuperadmin()` dans `apps/web-hub/src/lib/auth/dal.ts` utilisant `unauthorized()` et `forbidden()` de `next/navigation` pour protéger les Server Components et Server Actions.
   - *Niveau 3 (Base de données RLS)* : Fonctions stables `is_superadmin()` et politiques RLS strictes garantissant l'étanchéité même en cas de contournement applicatif.
4. **Journalisation immuable (`hub_audit_logs`)** :
   Création d'une table append-only sans politique `UPDATE` ni `DELETE`. Enregistrement de l'acteur (`actor_id`, `actor_email`), de l'action, de la cible (`target_type`, `target_id`, `tenant_id`), du motif obligatoire (notamment pour bris de glace ou suspension), de l'adresse IP et des métadonnées contextuelles.

## Alternatives Considered

- Stocker le rôle dans `raw_user_meta_data` : rejeté formellement car éditable côté client par l'utilisateur connecté via l'API Supabase standard.
- Filtrage de sécurité uniquement dans l'interface UI (React) : rejeté car inefficace contre les requêtes directes sur les Server Actions ou les endpoints d'API.
- Accès superadmin sans MFA obligatoire : rejeté en raison du risque inacceptable qu'une compromission d'identifiant ferait peser sur l'ensemble des tenants du SaaS.

## Risks

- Si le Hook JWT n'est pas encore coché dans le tableau de bord Supabase (Auth > Hooks), le DAL et le middleware implémentent un mécanisme de repli (fallback) vérifiant directement `profiles.role` pour éviter tout blocage ou dégradation de sécurité.
- Perte du terminal TOTP pour un Super Admin : nécessite une réinitialisation par un autre Super Admin via clé privilégiée ou la console de maintenance.

## Verification

- Command: `npm run quality:decisions`
- Test: Validation du format ADR et passage des tests de filtrage des accès non-superadmin
- Manual check: Déploiement de la migration SQL sur Supabase et test du flux de redirection MFA
