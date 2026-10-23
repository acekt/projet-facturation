# ADR-0019: Desktop Tenant Enrollment, License Read-Only Guard, and SQLite V1 to V2 Migration

## Status

Accepted

## Scope

- Area: Tenant Lifecycle, Onboarding Enrollment, Licensing & Offline Guard, SQLite Migration
- Library or platform: Next.js 16 Server Actions, Supabase Auth / JS SDK, better-sqlite3
- Installed version: @supabase/supabase-js ^2.90.1, better-sqlite3 ^12.6.2, bcryptjs ^2.4.3
- Related files:
  - `apps/desktop/lib/api/license.ts`
  - `apps/desktop/lib/db/migrateLegacy.ts`
  - `apps/desktop/lib/services/EnrollmentService.ts`
  - `apps/desktop/app/actions/setup.actions.ts`
  - `apps/desktop/app/actions/invoice.actions.ts`
  - `apps/desktop/app/actions/quote.actions.ts`
  - `apps/desktop/app/actions/credit-note.actions.ts`
  - `apps/desktop/app/setup/setup-client.tsx`
  - `apps/desktop/tests/unit/phase2-enrollment-license-migration.test.ts`

## Documentation Source

- Context7 source: `/supabase/supabase` (Auth signInWithPassword, getUser session tokens)
- Official fallback source: https://supabase.com/docs/guides/auth/passwords
- Date checked: 2026-10-22

## Context

Dans le modèle Hub & Spoke du progiciel Facturier :
1. **Multi-postes & Enrôlement** : Lors de l'installation d'un nouveau terminal de caisse ou poste collaborateur dans une entreprise cliente, le flux d'installation (`/setup`) ne permettait initialement que la création d'une nouvelle entreprise locale. Il était impossible de rejoindre directement une organisation existante gérée sur le Web Hub ou un poste maître.
2. **Migration des bases SQLite locales héritées (V1 ➔ V2)** : Certaines installations précédentes disposaient de bases locales créées avant l'architecture multi-tenant stricte, avec des identifiants numériques simples et des colonnes `tenant_id` manquantes ou `NULL`.
3. **Gestion des licences échues & obligations fiscales** : Conformément aux exigences comptables et fiscales (notamment au Gabon / CEMAC), en cas d'expiration de licence ou d'abonnement SaaS, une entreprise doit impérativement pouvoir continuer à consulter son historique, rechercher ses factures et exporter/imprimer ses documents comptables au format PDF. Cependant, l'émission de nouvelles factures, devis ou avoirs doit être bloquée avec un message d'avertissement et une période de grâce de 7 jours.

## Decision

1. **Service d'Enrôlement Multi-Postes (`EnrollmentService`)** :
   - Ajout de la méthode `enrollWithCloudTenant` permettant d'authentifier les collaborateurs avec leurs identifiants Cloud Supabase (`email` / `password`), de vérifier l'appartenance à un tenant actif et d'importer son identité fiscale.
   - Hachage local du mot de passe avec `bcryptjs` et écriture dans la table locale `users` pour garantir une authentification locale 100% autonome hors-ligne ultérieure.
   - Interface utilisateur adaptative dans `setup-client.tsx` avec sélecteur élégant : "Nouvelle Entreprise" ou "Rejoindre une Organisation / Activer une Licence".

2. **Migration Transparente et Sécurisée V1 ➔ V2 (`migrateLegacyDatabase`)** :
   - Détection automatique et non-bloquante au démarrage de `db.ts` des tables locales sans `tenant_id` ou avec des identifiants non-UUIDv4.
   - Création préalable d'une copie de sauvegarde horodatée (`[dbPath].v1-backup-[timestamp].sqlite`) avec rotation automatique limitant à 5 sauvegardes.
   - Backfill du `tenant_id` sur toutes les tables existantes (`clients`, `quotes`, `quote_items`, `invoices`, `invoice_items`, `payments`, `services`, `users`, `credit_notes`, `credit_note_items`, `audit_logs`).
   - Normalisation des identifiants primaires et mise à jour atomique des relations de clés étrangères (`clientId`, `quoteId`, `invoiceId`).
   - Idempotence complète enregistrée dans `sync_meta`.

3. **Garde de Licence en Lecture Seule & Période de Grâce (`assertLicenseAllowsCreation`)** :
   - Mise en place d'un cache local résilient dans `sync_meta` (`license:status`, `license:expires_at`).
   - Tolérance d'une période de grâce de 7 jours (`isInGracePeriod = true`) en cas de dépassement récent avec avertissement dans l'interface sans interruption d'activité.
   - Verrouillage strict en consultation seule (`isReadOnly = true`, levée de `LicenseRestrictedError`) sur licence expirée hors période de grâce ou organisation suspendue administrativement.
   - Préservation intégrale et sans restriction de la consultation documentaire (`getInvoices`, `getQuotes`, `getCreditNotes`, visualisations, filtres) et de l'export PDF.

## Alternatives Considered

- Alternative 1 : Bloquer complètement le lancement de l'application en cas de licence expirée — Rejeté car cela priverait illégalement l'entreprise de l'accès à ses archives comptables exigé par le Code Général des Impôts gabonais.
- Alternative 2 : Forcer une migration manuelle via script CLI externe — Rejeté car inapplicable pour les utilisateurs finaux sur application desktop Electron.

## Risks

- Risk: Conflit de mot de passe si un utilisateur change son mot de passe sur le Web Hub alors que le poste Desktop est hors-ligne.
- Mitigation: Le Desktop valide le mot de passe local hors-ligne, et met à jour le hash local lors de la prochaine synchronisation réussie avec Supabase Auth.

## Verification

- Command: `npm run quality:decisions`
- Test: `npx vitest run tests/unit/phase2-enrollment-license-migration.test.ts`
- Manual check: Vérification des flux `/setup` enrôlement Cloud et des gardes de licence expirée.
