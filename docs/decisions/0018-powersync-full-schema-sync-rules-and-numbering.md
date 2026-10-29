# ADR-0018: PowerSync Full Replication Schema, Sync Rules, and Numbering Collision Prevention

## Status

Superseded by ADR-0038

## Scope

- Area: Replication Engine, Schema Synchronization, Invoicing Numbering
- Library or platform: @powersync/web, Supabase PostgreSQL, SQLite
- Installed version: @powersync/web ^2.4.2, @powersync/react ^2.0.2
- Related files:
  - `apps/desktop/lib/powersync/AppSchema.ts`
  - `supabase/sync_rules.yaml`
  - `powersync/sync_rules.yaml`
  - `apps/desktop/lib/api/numbering.ts`
  - `apps/desktop/lib/sync/CloudSyncService.ts`
  - `apps/desktop/tests/unit/powersync-schema-sync-rules.test.ts`

## Documentation Source

- Context7 source: `/websites/powersync` (Schema definitions, Table column types, and Sync Rules syntax)
- Official fallback source: https://docs.powersync.com/client-sdks/reference/web
- Date checked: 2026-10-22

## Context

L'architecture Hub & Spoke nécessite une réplication fluide entre le cloud (PostgreSQL Supabase) et les terminaux de caisse locaux (SQLite).
Initialement, `AppSchema.ts` ne couvrait que 4 tables partielles (`tenants`, `profiles`, `clients`, `invoices`), omettant les devis, avoirs, règlements, services, paramètres et annonces broadcast.
De plus, aucun fichier formel `sync_rules.yaml` n'était défini pour partitionner les buckets PowerSync par `tenant_id`.
Enfin, lors de l'émission de factures simultanées par deux postes hors-ligne d'une même entreprise, l'unicité du numéro de document (`tenant_id`, `number`) risquait de générer une collision PostgreSQL `23505 duplicate key`.

## Decision

1. **Extension exhaustive d'`AppSchema.ts`** :
   Définition des 14 tables de données (`tenants`, `profiles`, `clients`, `services`, `quotes`, `quote_items`, `invoices`, `invoice_items`, `payments`, `credit_notes`, `credit_note_items`, `audit_logs`, `tenant_settings`, `announcements`) avec typage strict PowerSync (`column.text`, `column.real`, `column.integer`) et indexation systématique sur `tenant_id`.

2. **Règles officielles `sync_rules.yaml`** :
   Création du fichier de configuration des buckets PowerSync avec extraction dynamique du `tenant_id` depuis le JWT ou la table `profiles`, garantissant une étanchéité multi-tenant absolue, et mise en place d'un bucket `announcements` pour diffuser les alertes du Super Admin vers les terminaux Desktop.

3. **Prévention et résolution des collisions de numérotation séquentielle** :
   - *Prévention proactive* : Ajout du support optionnel d'un identifiant de caisse/poste (`FACTURIER_DEVICE_PREFIX` / paramètre `devicePrefixInput`) dans `formatDocNumber`, produisant des numéros distincts (ex: `FAC-P1-001/GAB/2026` vs `FAC-P2-001/GAB/2026`).
   - *Résilience réactive* : Maintien du mécanisme `pushNumberedRowsWithConflictFallback` dans `CloudSyncService.ts` qui suffixe automatiquement les numéros en cas de collision Postgres 23505 survenue hors-ligne.

## Alternatives Considered

- Alternative 1 : Utiliser un timestamp ou UUID comme numéro de facture affiché au client — Rejeté car non conforme aux exigences fiscales gabonaises (DGI) exigeant une numérotation séquentielle continue lisible.
- Alternative 2 : Imposer une connexion internet obligatoire pour réserver le numéro de facture — Rejeté car viole le principe fondamental Offline-First / Local-First du Facturier.

## Risks

- Risk: Augmentation de la taille mémoire du schéma PowerSync sur le client.
- Mitigation: Seules les colonnes nécessaires au fonctionnement métier sont incluses, et SQLite applique des index ciblés sur `tenant_id` et clés étrangères.

## Verification

- Command: `npm run quality:decisions`
- Test: `npx vitest run tests/unit/powersync-schema-sync-rules.test.ts`
- Manual check: Vérification du schéma `AppSchema.ts` et du fichier `supabase/sync_rules.yaml`.
