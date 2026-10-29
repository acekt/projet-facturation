# ADR-0040: Durcissement du Schéma SQLite/PostgreSQL et RLS Performante

## Status

Accepted

## Scope

- Area: Schéma SQLite local, migrations transactionnelles, contraintes entières, multi-tenant strict, RLS Supabase performante, stockage externe de logos
- Library or platform: SQLite local (better-sqlite3), Supabase PostgreSQL, Storage
- Installed version: better-sqlite3 12.10.0, @supabase/supabase-js 2.117.3
- Related files:
  - `apps/desktop/lib/db/migrations/types.ts`
  - `apps/desktop/lib/db/migrations/0001_initial_schema.ts`
  - `apps/desktop/lib/db/migrations/0002_schema_hardening.ts`
  - `apps/desktop/lib/db/migrations/index.ts`
  - `apps/desktop/lib/db.ts`
  - `apps/desktop/lib/api/tenant.ts`
  - `apps/desktop/lib/api/logo-storage.ts`
  - `supabase/migrations/20261028_schema_hardening.sql`
  - `apps/desktop/tests/unit/sqlite-migrations-hardening.test.ts`

## Documentation Source

- Context7 source: `/supabase/supabase` (guides on Row Level Security performance, `security definer`, `search_path = ''`, `(select auth.uid())` wrapper, `initPlan` query caching)
- Official fallback source: SQLite Alter Table & Table Reconstruction official documentation
- Date checked: 2026-10-28

## Context

L'audit architectural a identifié 4 dettes structurelles majeures touchant la persistance des données :
1. **Migrations SQLite ad-hoc opportunistes** : `lib/db.ts` exécutait au démarrage une succession de blocs `CREATE TABLE IF NOT EXISTS` suivis de multiples `PRAGMA table_info` et `ALTER TABLE ADD COLUMN` individuels sans versionnement ni transactionnalité (dette D11).
2. **Montants monétaires en flottants (REAL / float)** : les montants étaient stockés en `REAL` / `double precision`, exposant les totaux aux imprécisions de calcul en virgule flottante, en contradiction avec la norme monétaire XAF (qui n'a pas de centimes et utilise des entiers stricts) (dette P11).
3. **Multi-tenancy lâche** : `buildTenantFilter` tolérait `OR tenant_id IS NULL OR tenant_id = ''`, affaiblissant l'isolation des données entre entreprises.
4. **RLS sous-optimale côté Supabase** : les fonctions d'évaluation RLS sans schéma privé et sans wrapper `(select ...)` provoquaient un avertissement `auth_rls_initplan` (0003) et des ré-évaluations par ligne sur les requêtes paginées (dette P13).
5. **Logo base64 lourd en base** : l'image de logo encodée en base64 dans `settings.logo` pesait plus de 300 kB dans la table SQLite et la table Supabase, saturant la bande passante de synchronisation (dette P12).

## Decision

Nous implémentons le durcissement du schéma local et cloud (Lot I du Plan Curatif) :

1. **Cadre de Migrations Versionné SQLite (`PRAGMA user_version`) (I1)** :
   - Mise en place du dossier `apps/desktop/lib/db/migrations/` avec runner transactionnel `runMigrations(db, dbPath)`.
   - Avant toute migration sur fichier disque, création automatique d'une copie de sauvegarde horodatée (`.pre-mig-v<version>-<timestamp>.sqlite`) et vérification d'intégrité `PRAGMA integrity_check`.
   - Migration 0001 (baseline) et Migration 0002 (reconstruction de tables).
   - Gestion stricte de `PRAGMA foreign_keys = OFF` hors de la transaction active pendant la reconstruction, avec contrôle `foreign_key_check` et totaux de contrôle avant/après identiques.

2. **Montants en Entiers et Contraintes Strictes (I2)** :
   - Reconstruction des tables `quotes`, `quote_items`, `invoices`, `invoice_items`, `payments`, `credit_notes`, `credit_note_items`, `services`.
   - Colonnes financières converties en `INTEGER NOT NULL DEFAULT 0 CHECK (col >= 0)`.
   - Contraintes `CHECK (status IN (...))` sur factures, devis, avoirs et clients.
   - `tenant_id TEXT NOT NULL` obligatoire ; suppression définitive de `OR tenant_id IS NULL` dans `buildTenantFilter`.

3. **Durcissement Schéma Cloud PostgreSQL (I3)** :
   - Migration SQL `20261028_schema_hardening.sql`.
   - Colonnes montants converties en `BIGINT` avec contraintes `CHECK (col >= 0)`.
   - Clés étrangères enfants créées avec `NOT VALID` puis validées par `VALIDATE CONSTRAINT` pour éviter les verrous longs en production.

4. **RLS Performante et Schéma Privé (I4 / P13)** :
   - Création du schéma `private` non exposé à l'API publique.
   - Fonctions `private.current_tenant_id()` et `private.is_superadmin()` avec `security definer`, `stable` et `set search_path = ''`.
   - Politiques de sécurité appelées avec `(select private.current_tenant_id())`, permettant au planificateur Postgres de mettre en cache le résultat au niveau de l'`initPlan`.
   - Indexation de toutes les clés étrangères (`invoice_items.invoice_id`, etc.) pour éliminer les analyses séquentielles.

5. **Logo Déporté Hors Base (I5 / P12)** :
   - Création du service `apps/desktop/lib/api/logo-storage.ts` enregistrant les logos sur le disque local dans `<dataDir>/logos/<sha256>.png`.
   - Ajout des colonnes `logo_path` et `logo_sha256` dans `settings` et `tenant_settings`.
   - Création du bucket Supabase Storage `tenant-logos` avec politiques RLS d'isolation.
   - Nettoyage du base64 volumineux de la base de données.

## Alternatives Considered

- Migrations opportunistes conservées avec try/catch : rejeté car non déterministe et incapable d'ajouter des contraintes de colonnes ou de modifier les types sous SQLite sans reconstruction.
- Maintien des centimes en flottant : rejeté car les devises d'Afrique centrale (XAF) et de l'ouest (XOF) n'utilisent aucune sous-unité monétaire.

## Risks

- Échec de migration si des lignes existantes contiennent des identifiants `tenant_id` nuls ou des références orphelines.
- Mitigation : assainissement préalable automatique, assignation au tenant administrateur par défaut, et rollback transactionnel en cas d'erreur.

## Verification

- `apps/desktop/tests/unit/sqlite-migrations-hardening.test.ts` : 7/7 tests passés (user_version, idempotence, montants entiers, contraintes CHECK, NOT NULL, buildTenantFilter strict, conservation des totaux).
- `npx vitest run --pool=threads` (desktop) : 51/51 fichiers de test passés, 276/276 tests passés.
- `npm run quality:decisions` : 40/40 ADR validés sans erreur.
