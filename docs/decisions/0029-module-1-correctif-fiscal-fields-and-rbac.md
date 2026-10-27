# ADR-0029: Conformité Fiscale (NIF/RCCM), Matrice RBAC Opérateur et Sécurité de Suppression du Module 1

## Status

Accepted

## Scope

- Area: apps/desktop, packages/database
- Library or platform: SQLite (better-sqlite3), PowerSync Local-First, Zod, Next.js 16 Server Actions, React 19
- Installed version: Next.js 16.4.3, React 19.2.0, better-sqlite3 12.6.2, @powersync/web 1.40.0
- Related files:
  - `packages/database/src/types/index.ts`
  - `apps/desktop/lib/types/api.ts`
  - `apps/desktop/lib/db.ts`
  - `apps/desktop/lib/powersync/AppSchema.ts`
  - `apps/desktop/lib/validations.ts`
  - `apps/desktop/app/actions/client.actions.ts`
  - `apps/desktop/components/pages/clients.tsx`
  - `apps/desktop/components/pages/services.tsx`
  - `apps/desktop/tests/helpers/db.ts`
  - `apps/desktop/tests/unit/module1-correctif.test.ts`

## Documentation Source

- Context7 source: Next.js Server Actions authorization patterns (`https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/forms.mdx`) & PowerSync Client Schema Definitions (`https://docs.powersync.com/client-sdk/reference/schema`)
- Official fallback source: `node_modules/next/dist/docs/` & OHADA / Code Général des Impôts Gabon (Mentions obligatoires sur factures)
- Date checked: 2026-10-27

## Context

L'audit approfondi du Module 1 (Clients & Services) sous l'angle métier, réglementaire et opérationnel a révélé quatre axes correctifs majeurs :
1. **Conformité Fiscale DGI & OHADA (NIF / RCCM)** : En zone CEMAC / Gabon, l'émission de factures valides déductibles requiert la présence du NIF (Numéro d'Identification Fiscale) et du RCCM du client entreprise. Ni le modèle de données SQLite, ni le schéma de synchronisation PowerSync, ni les formulaires clients n'enregistraient ces métadonnées fiscales.
2. **Matrice RBAC trop rigide pour les opérateurs de vente** : Les opérateurs commerciaux (rôle `user`) en charge de l'encaissement et de l'édition des devis/factures étaient dans l'incapacité d'enregistrer un client nouvellement prospecté ou de mettre à jour son adresse, car `client.actions.ts` exigeait impérativement le rôle `admin`. Cela créait des goulots d'étranglement opérationnels lors des ventes comptoir.
3. **Absence de garde-fou comptable lors de la suppression d'un client** : La fonction `deleteClient` procédait au soft-delete sans vérifier si le client présentait des factures impayées actives. Supprimer un client débiteur laissait des créances orphelines dans les rapports de recouvrement.
4. **Saisie monétaire non conforme à la devise XAF** : Dans `services.tsx`, le champ de prix unitaire proposait `step="0.01"`, invitant à la saisie de centimes inexistants en Franc CFA (XAF) et risquant de générer des micro-écarts comptables.

## Decision

1. **Extension du Schéma et Réplication PowerSync (NIF & RCCM)** :
   - Ajout des attributs optionnels `nif?: string | null` et `rccm?: string | null` dans l'interface canonique `IClient` (`packages/database`), les types d'API (`ClientCreateRequest`, `ClientUpdateRequest`, `DbClient`), et le schéma Zod (`lib/validations.ts`).
   - Mise à jour du schéma SQLite (`lib/db.ts`) avec migration automatique idempotente via `ALTER TABLE clients ADD COLUMN ...`.
   - Alignement de la définition `AppSchema.ts` pour PowerSync avec les colonnes `nif: column.text` et `rccm: column.text`.
   - Alignement du schéma de test SQLite in-memory (`tests/helpers/db.ts`).
2. **Assouplissement Opérationnel du RBAC Commercial** :
   - Autorisation accordée aux rôles `admin` et `user` pour la création (`createClient`) et la mise à jour (`updateClient`) des clients afin de fluidifier les processus de devis et facturation.
   - Maintien strict de la suppression (`deleteClient`) réservée exclusivement aux administrateurs (`role === 'admin'`).
3. **Garde-Fou Transactionnel Contre la Suppression de Débiteurs Actifs** :
   - Avant tout soft-delete d'un client, `deleteClient` exécute un contrôle d'intégrité sur les factures rattachées non soldées (`status IN ('UNPAID', 'PARTIALLY_PAID') AND deletedAt IS NULL`).
   - En présence de créances impayées, la suppression est bloquée et retourne un message d'erreur explicite indiquant le nombre de factures impayées et le montant total de la dette en FCFA.
4. **Intégrité UI et Respect de la Devise XAF** :
   - Ajout des champs NIF et RCCM dans les modales d'ajout et d'édition de client (`clients.tsx`) et dans l'export CSV.
   - Forçage du champ prix unitaire dans `services.tsx` avec `step="1"`, `min="0"` et conversion explicite `parseInt(..., 10)`.
5. **Validation par Suite de Tests Dédiée** :
   - Création de `tests/unit/module1-correctif.test.ts` validant les 4 scénarios (persistance NIF/RCCM, création par un opérateur, interdiction de suppression pour un opérateur, et blocage de suppression en présence d'impayés).

## Risks

- Conflit de migration SQLite sur base existante : Nul, car `PRAGMA table_info` vérifie préalablement la présence de la colonne avant tout `ALTER TABLE`.
- Émission de factures sans NIF : Les champs NIF et RCCM restent optionnels pour permettre la facturation de particuliers (B2C) sans bloquer le système.

## Consequences

- Conformité fiscale totale pour la facturation d'entreprises B2B au Gabon (DGI / OHADA).
- Suppression des frictions de vente pour les opérateurs commerciaux tout en préservant la gouvernance financière (protection contre la suppression de débiteurs).
- 205 tests unitaires et d'intégration validés à 100% sans aucune régression.

## Verification

- Command: `npm run quality:decisions`
- Test: `npx vitest run tests/unit/module1-correctif.test.ts` (4/4 passés) et `npm run test` (205/205 passés)
- Manual check: Les formulaires clients affichent les champs NIF et RCCM, les devis et factures peuvent exploiter ces mentions, et la suppression d'un client endetté est rejetée.
