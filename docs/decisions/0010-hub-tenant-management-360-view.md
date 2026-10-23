# ADR-0010: Gestion des Tenants, Vue 360° Client et Procédure de Bris de Glace

## Status

Accepted

## Scope

- Area: Hub Web / Gestion des Tenants / Vue 360° Client / Bris de Glace / Audit
- Library or platform: Next.js 16 Server Actions, Supabase PostgreSQL RLS, React 19
- Installed version: @supabase/ssr 0.12.7, next 16.4.0, recharts 2.15.0
- Related files: `apps/web-hub/src/app/admin/tenants/page.tsx`, `apps/web-hub/src/app/admin/tenants/[id]/page.tsx`, `apps/web-hub/src/app/admin/tenants/actions.ts`, `apps/web-hub/src/lib/kpi/tenant360.ts`

## Documentation Source

- Context7 source: `/supabase/supabase` (PostgreSQL RLS `is_superadmin()`, Server Actions data mutation), Next.js 16 docs (Server Actions `revalidatePath`, App Router dynamic routes)
- Official fallback source: documentation officielle Supabase & Next.js
- Date checked: 2026-10-20

## Context

Le Super Admin du Hub a la responsabilité d'administrer l'ensemble des entreprises clientes opérant sur le SaaS. Cela englobe la création de nouveaux comptes entreprise, la gestion de leur cycle de vie (essai gratuit, activation, changement de plan tarifaire, suspension pour impayé ou clôture), ainsi que l'assistance technique avancée.
Afin de concilier efficacité du support et respect intransigeant de la confidentialité des données des clients, l'usurpation d'identité (« impersonation ») a été rejetée. À la place, une procédure d'accès exceptionnelle dite de « Bris de Glace » doit être mise en œuvre : elle permet un accès d'investigation en lecture seule, conditionné par la saisie d'un motif obligatoire (ex: numéro de ticket d'assistance) et tracé de manière indélébile dans `hub_audit_logs`.

## Decision

1. **Centre de Gestion des Tenants (`/admin/tenants`)** :
   Affichage consolidé de toutes les entreprises clientes avec filtres multicritères (par statut : actif, essai, suspendu, expiré ; par plan tarifaire : starter, pro, enterprise) et recherche textuelle instantanée. Déclenchement d'actions directes (suspension, réactivation, changement de plan, export CSV).
2. **Fiche Tenant 360° (`/admin/tenants/[id]`)** :
   Interface organisée en 5 onglets spécialisés :
   - *Vue d'ensemble* : identité juridique, pays, dates d'échéance de licence, notes internes confidentielles.
   - *Utilisateurs* : membres rattachés au tenant (`profiles` : email, rôle, statut d'activité).
   - *Postes & Synchro* : flotte de terminaux Desktop connectés (`sync_devices` : OS, version, dernière synchro) et historique des réplications (`sync_runs`).
   - *Finances* : métriques d'activité (factures émises, devis, règlements encaissés).
   - *Audit & Bris de Glace* : journal des opérations Super Admin sur ce tenant et bouton d'accès exceptionnel sécurisé.
3. **Suspension administrative immédiate** :
   Server Action [toggleTenantStatusAction](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/apps/web-hub/src/app/admin/tenants/actions.ts) actualisant `tenants.status` et `tenants.suspended_reason`. Dès le cycle suivant de `CloudSyncService.ts`, le poste Desktop se voit refuser la réplication tout en conservant ses données locales.
4. **Protocole de Bris de Glace tracé (D9)** :
   L'accès de support aux données d'un client impose la saisie d'un motif légitime. L'action est enregistrée dans `hub_audit_logs` avec l'adresse IP et l'acteur Superadmin.

## Alternatives Considered

- Impersonation totale (connexion sous l'identité d'un utilisateur du client) : rejeté formellement car cela violerait l'imputabilité des écritures comptables et exposerait à des risques de litiges.
- Accès transparent sans formalité pour le Super Admin : rejeté au nom du principe de sécurité par défaut et de conformité aux normes d'audit financier.

## Risks

- Un tenant suspendu continue d'utiliser son application locale-first hors-ligne pour la consultation de son historique existant, mais aucune synchronisation cloud n'est autorisée tant que la situation n'est pas régularisée.

## Verification

- Command: `npm run quality:decisions`
- Test: Passage des tests de typecheck et validation des actions de modification de statut et de bris de glace
- Manual check: Test de suspension d'un tenant et vérification de son rejet au niveau de la réplication Desktop
