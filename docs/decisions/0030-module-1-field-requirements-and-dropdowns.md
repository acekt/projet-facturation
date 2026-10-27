# ADR-0030: Ajustement des Contraintes de Champs (Obligatoires vs Optionnels) et Standardisation en Listes Déroulantes pour le Module 1

## Status

Accepted

## Scope

- Area: apps/desktop, packages/database
- Library or platform: Zod, Radix UI Select (@workspace/ui/components/select), SQLite (better-sqlite3), Next.js 16 Server Actions
- Installed version: Next.js 16.4.3, React 19.2.0, Zod 3.24.2, @radix-ui/react-select 2.1.6
- Related files:
  - `packages/database/src/types/index.ts`
  - `apps/desktop/lib/types/api.ts`
  - `apps/desktop/lib/validations.ts`
  - `apps/desktop/app/actions/client.actions.ts`
  - `apps/desktop/components/pages/clients.tsx`
  - `apps/desktop/components/pages/services.tsx`
  - `apps/desktop/components/pages/invoice-editor.tsx`
  - `apps/desktop/components/pages/quote-editor.tsx`
  - `apps/desktop/tests/helpers/db.ts`
  - `apps/desktop/tests/unit/module1-fields-and-dropdowns.test.ts`

## Documentation Source

- Context7 source: Radix UI Select (`https://www.radix-ui.com/primitives/docs/components/select`) & Zod Schema Validation (`https://zod.dev/?id=unions`)
- Official fallback source: `node_modules/next/dist/docs/`
- Date checked: 2026-10-27

## Context

L'observation en profondeur des flux opérationnels de facturation sur le terrain en zone CEMAC / Gabon a mis en exergue deux incohérences majeures :
1. **Contrainte email irréaliste sur les fiches clients** : Dans l'état initial, le champ email était marqué d'un astérisque rouge `*`, possédait l'attribut HTML `required`, et le schéma Zod bloquait l'enregistrement si aucun email valide n'était fourni. Or, dans les transactions B2C, chez les artisans et les commerces de détail, de nombreux clients ne disposent pas d'adresse email ou effectuent des achats comptoir. L'obligation de renseigner un email forçait la création d'adresses fictives ou empêchait l'émission de devis/factures.
2. **Saisie textuelle libre pour des attributs catégoriels fermés** :
   - Dans le catalogue de services, le champ `category` était un champ de saisie libre (`Input`). Les utilisateurs saisissaient des variantes ("Prestation", "prestations", "Service", "IT", "Dev") perturbant les filtres, le reporting et l'harmonisation visuelle des badges.
   - Dans la gestion des clients, le statut du compte (`active` ou `inactive`) n'était pas manipulable via un composant de sélection contrôlé dans le formulaire.

## Decision

1. **Recalibrage des Champs Obligatoires et Optionnels (Clients)** :
   - **Champ Obligatoire avec `*` et validation stricte** : `name` (Nom complet ou Raison sociale). Min 1 caractère, max 255 caractères.
   - **Champs Optionnels (sans `*`, avec mention explicite `(optionnel)`)** :
     - `email` : Optionnel et nullable. Le schéma Zod autorise `z.union([z.string().email(), z.literal("")]).optional().nullable()`. La vérification d'unicité d'email côté serveur (`createClient` et `updateClient`) ne s'exécute que si l'email renseigné est non vide. Plusieurs clients sans email peuvent coexister sans collision.
     - `phone`, `address`, `nif`, `rccm` : Optionnels et nullables.
   - **Protection contre les plantages Runtime `null`** : Sécurisation de tous les filtres de recherche et affichages dans `clients.tsx`, `invoice-editor.tsx`, et `quote-editor.tsx` via `(client.email || '').toLowerCase()`.

2. **Recalibrage des Champs Obligatoires et Optionnels (Services)** :
   - **Champs Obligatoires avec `*` et validation stricte** :
     - `name` (Nom du service / prestation) : Min 1 caractère.
     - `unitPrice` (Prix Unitaire XAF) : Entier >= 0.
   - **Champs Optionnels** :
     - `category` : Optionnel.
     - `description` : Optionnel.

3. **Standardisation sous Forme de Listes Déroulantes (`Select`)** :
   - **Catégorie de Service (`services.tsx`)** : Remplacement de l'input texte par un `<Select>` Radix UI standardisé avec la liste fermée `PREDEFINED_SERVICE_CATEGORIES` ("Prestation de services", "Conseil & Expertise", "Développement & IT", "Maintenance & Support", "Formation & Coaching", "Autre prestation"), tout en préservant la compatibilité avec les catégories historiques.
   - **Statut Client (`clients.tsx`)** : Ajout d'une liste déroulante `<Select>` permettant de sélectionner explicitement le statut du client : `"Actif"` (`active`) ou `"Inactif / Suspendu"` (`inactive`) lors de la création et de la modification.

4. **Couverture de Tests Automatisée** :
   - Création de la suite de tests `tests/unit/module1-fields-and-dropdowns.test.ts` (9 tests) validant l'ensemble des règles de validation Zod, la création sans email, et la persistance des statuts.

## Alternatives Considered

- Alternative 1 : Rendre le téléphone obligatoire si l'email est absent. Rejeté pour l'instant car certains devis rapides ne nécessitent qu'un nom de contact avant finalisation.
- Alternative 2 : Conserver la catégorie de service en texte libre avec autocomplétion datalist. Rejeté car le composant `<Select>` du design system garantit un rendu uniforme en mode sombre et clair conforme aux standards Fintech du projet.

## Risks

- Risk : Incompatibilité de schéma lors de l'export CSV ou de l'affichage si `email` est `null`.
- Mitigation : Valeurs de repli défensives (`—` ou chaîne vide) appliquées dans la table, les cartes et la fonction `escapeCsvCell`.

## Verification

- Command : `npm run quality:decisions`
- Test : `npx vitest run tests/unit/module1-fields-and-dropdowns.test.ts`
- Manual check : Vérification visuelle des formulaires avec astérisques rouges uniquement sur les champs strictement requis et présence des menus déroulants de sélection.
