# ADR-0024: Desktop Company-First Setup Architecture and Exhaustive Settings Onboarding

## Status

Accepted

## Scope

- Area: Desktop Onboarding UX, Domain-Driven Multi-Tenancy Initialization, Settings Persistence, Zod Schema Composition
- Library or platform: Next.js 16 Server Actions, better-sqlite3, Zod ^3.24.1
- Installed version: next 16.4.0, better-sqlite3 ^12.10.0, zod ^3.24.1
- Related files:
  - apps/desktop/app/setup/setup-client.tsx
  - apps/desktop/lib/validations.ts
  - apps/desktop/lib/repositories/SettingsRepository.ts
  - apps/desktop/lib/services/SetupService.ts
  - apps/desktop/app/actions/setup.actions.ts

## Documentation Source

- Context7 source: /colinhacks/zod (Object schema spread composition, default values, safe validation)
- Context7 source: /websites/zod_dev (Multi-step form schema validation and partial refinements)
- Date checked: 2026-10-26

## Context

Dans les versions initiales du progiciel Facturier :
1. **Ordre antinomique de l'embarquement** : L'écran `/setup` demandait la création du compte Administrateur (Étape 1) avant même de configurer l'Entreprise (Étape 2). Or, dans un système multi-tenant étanche, le Tenant (l'Entreprise) est l'entité racine à laquelle se rattachent les utilisateurs.
2. **Couverture incomplète des paramètres** : Seuls 5 champs sommaires (nom, NIF, RCCM, adresse, email) étaient collectés. Des valeurs critiques (forme juridique, fiscalité gabonaise, trigramme entreprise, préfixes factures/devis, coordonnées bancaires de virement et délai de session) étaient ignorées et forcées en dur dans `SettingsRepository.upsertInitialSettings`, forçant l'utilisateur à se rendre immédiatement dans les Paramètres après l'installation pour finaliser sa configuration légale.

## Decision

1. **Inversion du flux (Company-First)** :
   - **Étape 1 : Profil & Paramètres Entreprise** (Tenant racine) :
     - Identité légale : Nom commercial, forme juridique (SARL, SA, SAS...), NIF, RCCM, adresse physique, téléphone, email et logo optionnel.
     - Facturation & Fiscalité : Code court d'entreprise (auto-généré), préfixe facture, préfixe devis, taux DGI gabonais (TVA 18%, CSS 1%, TPS 9.5%) et mentions légales par défaut.
     - Coordonnées Bancaires : Banque, agence, n° de compte, code SWIFT/BIC et IBAN/RIB pour les règlements clients.
     - Sécurité : Délai d'expiration de session d'inactivité.
   - **Étape 2 : Compte Administrateur Local** :
     - Nom complet, adresse email, mot de passe fort (haché par `bcryptjs`) et téléphone.
     - Rattachement automatique au `tenant_id` généré pour l'entreprise.

2. **Composition modulaire Zod (`validations.ts`)** :
   - Découpage en `companySetupSchema` et `adminSetupSchema` composés via spread syntax (`setupSchema = z.object({ ...companySetupSchema.shape, ...adminSetupSchema.shape })`) assurant la validation stricte de bout en bout sans duplication.

3. **Persistance atomique complète (`SettingsRepository.ts` & `SetupService.ts`)** :
   - Mise à jour de `SettingsRepository.upsertInitialSettings` avec clause SQLite `ON CONFLICT(id) DO UPDATE SET` pour insérer et mettre à jour de manière atomique l'intégralité des 22 colonnes de la table `settings`.

## Alternatives Considered

- Alternative 1 : Garder un formulaire monolithique d'une seule page. Rejeté car 20 champs sur un seul écran créent une surcharge cognitive pour le premier démarrage. Le format stepper en 2 étapes avec sous-onglets ergonomiques offre un meilleur équilibre.
- Alternative 2 : Forcer les coordonnées bancaires comme obligatoires. Rejeté car certaines micro-entreprises n'ont pas encore finalisé l'ouverture de leur compte bancaire au moment de l'installation du logiciel.

## Risks

- Risk: Risque de régression sur les tests unitaires existants appelant l'ancienne signature de `upsertInitialSettings`.
- Mitigation: Surcharge de méthode préservée dans `SettingsRepository.upsertInitialSettings` acceptant indifféremment l'objet riche `InitialSettingsInput` ou l'ancienne signature à paramètres positionnels.

## Verification

- Command: `npm run typecheck`
- Command: `npm run quality:decisions`
