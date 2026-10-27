# ADR-0031: Indexation Composite SQLite, Étanchéité Multi-Tenant et Piste d'Audit Préventive (Module 1)

## Status

Accepted

## Scope

- Area: apps/desktop, packages/database
- Library or platform: SQLite (better-sqlite3), PowerSync Client SDK, Next.js 16 Server Actions
- Installed version: Next.js 16.4.3, better-sqlite3 12.6.2, @powersync/web 1.40.0
- Related files:
  - `apps/desktop/lib/db.ts`
  - `apps/desktop/lib/powersync/AppSchema.ts`
  - `apps/desktop/app/actions/client.actions.ts`
  - `apps/desktop/tests/helpers/db.ts`
  - `apps/desktop/tests/unit/module1-preventif.test.ts`

## Documentation Source

- Context7 source: SQLite Partial Indices & Multi-Column Index Optimization (`https://www.sqlite.org/partialindex.html`), PowerSync Client Index Specifications (`https://docs.powersync.com/client-sdk/reference/schema`)
- Official fallback source: `node_modules/next/dist/docs/`
- Date checked: 2026-10-27

## Context

Dans le cadre de la Phase 3 (Plan Préventif) pour le Module 1 (Clients & Services), plusieurs axes d'anticipation et de robustesse industrielle devaient être traités avant la mise en production :
1. **Performance et Scalabilité des Requêtes Clés** :
   - La vérification de doublons par email sur les clients (`SELECT id FROM clients WHERE lower(email) = lower(?) AND tenant_id = ? AND deletedAt IS NULL`) effectuait un scan linéaire ou partiel faute d'index sur l'expression `lower(email)`.
   - La vérification de doublons sur les services (`SELECT id FROM services WHERE lower(name) = lower(?) AND tenant_id = ? AND deletedAt IS NULL`) subissait le même problème.
   - Le contrôle de sécurité bloquant la suppression d'un client en cas de factures impayées (`SELECT COUNT(*) FROM invoices WHERE clientId = ? AND status IN ('UNPAID', 'PARTIALLY_PAID') AND deletedAt IS NULL`) pouvait ralentir considérablement lors de la montée en charge à des milliers de factures.
2. **Étanchéité Multi-Tenant sur le Contrôle des Impayés** :
   - La requête `activeInvoices` dans `deleteClient` ne filtrait pas explicitement par le `tenant_id` actif, créant un risque théorique d'interférence en cas de collision d'identifiant ou d'erreur de contexte.
3. **Alignement du Schéma PowerSync Client (`AppSchema.ts`)** :
   - Les index locaux sur PowerSync devaient refléter les filtres de navigation fréquents (`tenant_id`, `email`, `name`, `status`).

## Decision

1. **Création d'Index Composites Partiels Dédiés dans `lib/db.ts` et `tests/helpers/db.ts`** :
   - `idx_clients_tenant_email` sur `clients(tenant_id, lower(email)) WHERE deletedAt IS NULL AND email IS NOT NULL` : accélère instantanément la vérification de doublon d'email par tenant tout en ignorant les clients sans email.
   - `idx_clients_tenant_name` sur `clients(tenant_id, lower(name)) WHERE deletedAt IS NULL` : optimise les recherches et tris par nom.
   - `idx_services_tenant_name` sur `services(tenant_id, lower(name)) WHERE deletedAt IS NULL` : accélère la vérification d'unicité des prestations au sein du tenant.
   - `idx_invoices_client_status` sur `invoices(tenant_id, clientId, status) WHERE deletedAt IS NULL` : transforme le contrôle d'impayés pré-suppression en un parcours d'index indexé ultrarapide.

2. **Sécurisation de l'Étanchéité Multi-Tenant dans `deleteClient`** :
   - Injection systématique du filtre de tenant `${tf.sql}` et des paramètres `...tf.params` dans la requête `activeInvoices` afin d'isoler hermétiquement le comptage des factures impayées au tenant de la session courante.

3. **Mise à Jour des Index PowerSync dans `AppSchema.ts`** :
   - Déclaration d'index composites sur les tables `clients` (`tenant`, `email`, `name`), `services` (`tenant`, `name`), et `invoices` (`tenant`, `client`, `number`, `client_status`).

4. **Suite de Tests de Validation Préventive (`tests/unit/module1-preventif.test.ts`)** :
   - Validation que `EXPLAIN QUERY PLAN` utilise effectivement les index composites ciblés.
   - Validation de l'étanchéité multi-tenant totale (interdiction de lecture, modification ou suppression inter-tenants ; unicité bornée au tenant).
   - Validation de la traçabilité intégrale (`audit_logs`) sur chaque opération CRUD.
   - Validation du garde-fou comptable interdisant la suppression de débiteurs actifs.

## Alternatives Considered

- Alternative 1 : Utiliser une contrainte d'unicité SQLite native `UNIQUE(tenant_id, email)`. Rejeté car les emails nuls ou supprimés (`deletedAt IS NOT NULL`) ne doivent pas entrer en conflit, et SQLite gère différemment les contraintes partielles sur des bases existantes sans migration complexe. L'index partiel conditionnel associé à la vérification programmatique dans les Server Actions offre flexibilité et performance maximale.

## Risks

- Risk : Surcoût d'écriture lors de la création d'enregistrements.
- Mitigation : Les index partiels ciblent uniquement les lignes actives (`deletedAt IS NULL`), minimisant l'empreinte disque et l'impact sur les écritures SQLite.

## Verification

- Command : `npm run quality:decisions`
- Test : `npx vitest run tests/unit/module1-preventif.test.ts`
- Query Plan : `EXPLAIN QUERY PLAN SELECT ...` confirmé sur chaque requête critique.
