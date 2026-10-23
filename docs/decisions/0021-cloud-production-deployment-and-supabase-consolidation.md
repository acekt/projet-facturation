# ADR-0021: Cloud Production Deployment, Supabase Migration Consolidation, and Hub Resilience

## Status

Accepted

## Scope

- Area: Cloud Deployment, Supabase Production Migrations, Next.js 16 Web-Hub Production Build, PowerSync Cloud Replication
- Library or platform: Supabase, Next.js 16, PowerSync, PostgreSQL 15+
- Installed version: @supabase/ssr ^0.8.0, next 16.4.0
- Related files:
  - `supabase/deploy_all_migrations.sql`
  - `supabase/migrations/20261013_attach_member.sql`
  - `supabase/migrations/20261013_desktop_sync.sql`
  - `supabase/migrations/20261020_hub_security.sql`
  - `supabase/migrations/20261021_hub_telemetry_kpis.sql`
  - `apps/web-hub/.env.example`
  - `apps/web-hub/src/app/mfa/page.tsx`
  - `powersync/sync_rules.yaml`
  - `apps/web-hub/tests/phase4-production-deployment-audit.test.ts`

## Documentation Source

- Context7 source: `/supabase/supabase-js` (production deployment best practices and SSR cookie patterns)
- Official fallback source: https://supabase.com/docs/guides/deployment
- Date checked: 2026-10-22

## Context

Dans le cadre du déploiement en production du Facturier (Hub & Spoke) :
1. **Consolidation des migrations PostgreSQL Supabase** : L'instance Supabase de production doit recevoir l'intégralité du modèle de données (19 tables : 14 tables répliquées multi-tenants, tables d'audit, profils, plans SaaS, télémétrie de flotte et rollups de KPIs). Ce déploiement doit être 100% idempotent pour être exécutable en une passe via le SQL Editor ou la CLI Supabase sans interruption de service.
2. **Compatibilité Next.js 16 (`cacheComponents` & Partial Prerendering)** : Le portail Super Admin (`apps/web-hub`) utilise Next.js 16 avec `cacheComponents: true` et `partialPrefetching: true`. Les pages serveur accédant aux cookies d'authentification (`/mfa`, `/login`, `/admin/*`) doivent explicitement configurer `export const instant = false;` et `await connection();` pour interdire le pré-rendu statique hors session et éviter les erreurs bloquantes au build de production (`next build`).
3. **Sécurité d'hébergement Cloud HTTPS & MFA** : Les protocoles de second facteur TOTP (RFC 6238) et WebAuthn (Passkeys) exigent impérativement un contexte sécurisé HTTPS pour le domaine de production (`hub.facturier.ga` ou Vercel/Railway).
4. **Partitionnement des flux PowerSync Cloud** : Les règles de synchronisation (`powersync/sync_rules.yaml`) doivent garantir l'étanchéité multi-tenant absolue en routant les données selon le paramètre dynamique `bucket.tenant_id`.

## Decision

1. **Bundle Consolidé Idempotent (`supabase/deploy_all_migrations.sql`)** :
   - Regroupement ordonné des 4 migrations fondamentales en un seul script avec clauses de protection `IF NOT EXISTS`, réinitialisation sécurisée des politiques RLS (`DROP POLICY IF EXISTS`) et triggers d'horodatage (`touch_server_updated_at`).
   - Maintien des index uniques anti-collision (`uq_quotes_tenant_number`, `uq_invoices_tenant_number`, `uq_credit_notes_tenant_number`).
   - Inclusion d'une requête de validation d'intégrité finale vérifiant la présence des 19 tables publiques.

2. **Résilience du Build de Production Web-Hub (`next build`)** :
   - Mise à niveau de `/mfa/page.tsx` avec `export const instant = false;` et `await connection();` en alignement avec l'architecture `AdminLayout` et `LoginPage`.
   - Validation que `npm run build` dans `apps/web-hub` compile et optimise avec succès l'intégralité des 18 routes applicatives.

3. **Template de Configuration de Production (`apps/web-hub/.env.example`)** :
   - Création du modèle formel documentant les variables obligatoires : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` (96 hex chars), et `POWERSYNC_URL`.
   - Consigne explicite d'activation HTTPS obligatoire pour la protection des cookies `SameSite=Lax; Secure`.

4. **Audit Automatisé de Déploiement (`phase4-production-deployment-audit.test.ts`)** :
   - 10 tests unitaires et d'audit automatisés validant la présence des tables, les RPCs (`attach_member`, `custom_access_token_hook`, `is_superadmin_aal2`), les index d'unicité, les variables d'environnement et la structure des buckets PowerSync.

## Alternatives Considered

- Alternative 1 : Exécution manuelle de scripts dispersés non idempotents — Rejeté car source majeure d'échecs partiels et d'incohérences de schéma lors des montées de version.
- Alternative 2 : Désactivation globale du cache Next.js via `export const dynamic = 'force-dynamic'` — Rejeté car incompatible avec l'option moderne `cacheComponents: true` de Next.js 16 (qui requiert `export const instant = false;`).

## Risks

- Risk: Injection d'un secret de session insuffisant ou utilisation de HTTP en environnement de pré-production.
- Mitigation: Validation par checklist et alertes documentées dans `.env.example` et instructions d'exploitation.

## Verification

- Command: `npm run quality:decisions`
- Command: `npx vitest run tests/phase4-production-deployment-audit.test.ts` (apps/web-hub)
- Command: `npm run build` (apps/web-hub)
