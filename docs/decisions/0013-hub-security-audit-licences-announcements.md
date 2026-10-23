# ADR-0013: Gouvernance de Sécurité, Piste d'Audit Immuable, Gestion des Licences et Diffusion d'Annonces

## Status

Accepted

## Scope

- Area: Hub Web / Piste d'Audit Immuable / Traçabilité RGPD / Gestion des Plans & Licences / Annonces Globales
- Library or platform: Next.js 16 Server Actions, Supabase PostgreSQL RLS, PostgreSQL Append-Only Architecture
- Installed version: @supabase/supabase-js 2.117.3, @supabase/ssr 0.12.7, next 16.4.0
- Related files: `apps/web-hub/src/app/admin/security/page.tsx`, `apps/web-hub/src/app/admin/licences/page.tsx`, `apps/web-hub/src/app/admin/announcements/page.tsx`, `apps/web-hub/src/lib/kpi/securityQueries.ts`, `apps/web-hub/src/lib/kpi/licenceActions.ts`, `apps/web-hub/tests/security-licences.test.ts`

## Documentation Source

- Context7 source: `/supabase/supabase-js` (PostgREST immutable auditing queries, RLS security enforcement), Next.js 16 Server Actions documentation
- Official fallback source: Documentation Supabase PostgreSQL RLS & Audit Tracing
- Date checked: 2026-10-21

## Context

L'exploitation d'une plateforme SaaS financière multi-tenant impose des exigences légales, réglementaires et opérationnelles rigoureuses :
1. **Piste d'Audit Immuable (Append-Only)** : Toute action d'administration sensible (accès de bris de glace, suspension d'entreprise, modification tarifaire de plan, réinitialisation de licence) doit être journalisée de manière infalsifiable avec horodatage UTC, identifiant de l'administrateur, adresse IP, user-agent et motif explicite obligatoire.
2. **Gouvernance des Licences & Monétisation** : Le Super Admin doit pouvoir configurer les plafonds techniques des plans SaaS (nombre max d'utilisateurs, de postes Desktop connectés, fonctionnalités incluses) et prolonger manuellement les licences ou périodes d'essai des entreprises clientes.
3. **Communication descendante (Broadcast Announcements) & Alertes Système** : Canal d'information direct depuis le Hub Cloud vers les terminaux Desktop pour notifier les fenêtres de maintenance planifiée, les alertes de sécurité critiques ou les évolutions fiscales.

## Decision

1. **Piste d'Audit & Journalisation Immuable (`/admin/security`)** :
   - Requêtage de la table `public.hub_audit_logs` protégée par RLS (zéro permission UPDATE ou DELETE accordée).
   - Filtrage multi-critères : par type d'action (`BREAK_GLASS_ACCESS`, `TENANT_SUSPEND`, `PLAN_UPDATE`, `LICENSE_EXTEND`, `ANNOUNCEMENT_CREATE`), par administrateur acteur et par plage de dates.
   - Modal d'inspection détaillée du payload JSON des métadonnées contextuelles.
   - Export CSV d'audit à valeur probante pour conformité réglementaire.
2. **Gestion des Plans & Licences SaaS (`/admin/licences`)** :
   - Tableau de bord des 4 plans fondamentaux (`free_trial`, `starter`, `pro`, `enterprise`) avec volume d'abonnés et estimation de CA généré.
   - Détection proactive des licences arrivant à échéance sous 30 jours pour anticiper les renouvellements commerciaux.
   - Server Actions sécurisées pour la création de plan, l'ajustement des quotas (utilisateurs, postes) et la prolongation de licence d'un tenant.
3. **Annonces Globales & Résolution d'Alertes (`/admin/announcements`)** :
   - Diffusion de messages ciblés (tous les tenants ou une entreprise spécifique) avec 4 niveaux de sévérité (`info`, `warning`, `maintenance`, `critical`).
   - Prise en charge des dates de début et fin de validité pour programmation préalable des maintenances.
   - Traitement des alertes système issues de `public.alerts` (accusé de réception et clôture).

## Alternatives Considered

- Stocker les logs d'audit dans des fichiers journaux sur le serveur Node.js : rejeté car vulnérable aux pertes lors des redéploiements et non interrogeable via l'interface Super Admin.
- Permettre la suppression administrative de logs d'audit anciens : formellement rejeté par impératif de non-répudiation et de conformité légale.

## Risks

- Croissance exponentielle du volume de logs : mitigée par l'indexation B-Tree optimisée sur `created_at`, `actor_id` et `tenant_id`.

## Verification

- Command: `npm run quality:decisions`
- Test: Validation des requêtes d'audit, des Server Actions de licences et de création d'annonces dans `apps/web-hub/tests/security-licences.test.ts`
- Manual check: Consultation des 3 modules `/admin/security`, `/admin/licences` et `/admin/announcements`
