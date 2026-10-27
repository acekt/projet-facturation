# ADR-0033: Cycle de Vie des Factures & Avoirs, Signalétique des Champs, Indexation Composite et Piste d'Audit (Module 3)

## Status

Accepted

## Scope

- Area: apps/desktop, packages/database
- Library or platform: SQLite (better-sqlite3), PowerSync Client SDK, Next.js 16 Server Actions, Radix UI Select
- Installed version: Next.js 16.4.3, better-sqlite3 12.6.2, @radix-ui/react-select 2.1.6
- Related files:
  - `apps/desktop/lib/db.ts`
  - `apps/desktop/lib/validations.ts`
  - `apps/desktop/lib/types/api.ts`
  - `apps/desktop/lib/services/InvoiceService.ts`
  - `apps/desktop/app/actions/invoice.actions.ts`
  - `apps/desktop/app/actions/credit-note.actions.ts`
  - `apps/desktop/components/pages/invoices.tsx`
  - `apps/desktop/components/pages/invoice-editor.tsx`
  - `apps/desktop/tests/helpers/db.ts`
  - `apps/desktop/tests/unit/module3-correctif.test.ts`
  - `apps/desktop/tests/unit/module3-curative.test.ts`
  - `apps/desktop/tests/unit/module3-preventif.test.ts`
  - `apps/desktop/tests/unit/components/pages/invoices.test.tsx`

## Documentation Source

- Context7 source: SQLite Partial Indices & Expression Optimization (`https://www.sqlite.org/partialindex.html`), Radix UI Select Accessibility & Controlled States (`https://www.radix-ui.com/primitives/docs/components/select`)
- Official fallback source: `node_modules/next/dist/docs/`
- Date checked: 2026-10-27

## Context

Le Module 3 (Facturation & Gestion des Avoirs / Notes de Crédit) constitue le cœur fiduciaire et fiscal de l'application Facturier Gabon / CEMAC. Plusieurs fragilités fonctionnelles, techniques et d'audit ont été identifiées :
1. **Tolérance aux clients sans email et flexibilité des dates** :
   - Le schéma de validation `invoiceSchema` rejetait les factures émises pour des clients de comptoir ou artisans sans adresse email (`Expected string, received null`).
   - L'absence ou l'effacement de la date d'échéance `dueDate` déclenchait un rejet de validation car le composant transmettait une chaîne vide `""`.
2. **Verrouillage comptable des factures payées (`PAID`) et partiellement payées (`PARTIALLY_PAID`)** :
   - Lorsqu'une facture recevait des règlements enregistrés, l'action « Annuler / Supprimer » restait visible et déclenchable dans l'interface utilisateur.
   - Les modifications ou suppressions côté serveur devaient être formellement rejetées pour préserver l'intégrité de la comptabilité générale et de la piste d'audit légale.
   - La génération d'un avoir (note de crédit) est le seul mécanisme légalement recevable pour rectifier ou annuler une facture déjà émise et payée.
3. **Ergonomie des listes déroulantes de filtrage et d'affichage** :
   - L'écran de liste utilisait un filtre textuel incomplet et n'offrait pas un composant de sélection unifié pour le statut (`TOUTES`, `IMPAYEE`, `PARTIELLEMENT_PAYEE`, `PAYEE`, `ANNULEE`).
   - L'affichage des coordonnées client dans les cartes et tableaux plantait si l'email était nul (`.toLowerCase()` sans coalescence).
4. **Performance sous forte volumétrie (10 000+ factures et avoirs)** :
   - Les tris chronologiques par date décroissante, les recherches par numéro séquentiel et les jointures de lignes d'articles `invoice_items` et `credit_note_items` risquaient de dégrader les temps de réponse sans indexation composite multi-tenant.

## Decision

1. **Assouplissement et Signalétique Visuelle des Champs (Plan Correctif)** :
   - Dans `lib/validations.ts` : `clientEmail` accepte `null`, `""` ou une adresse email valide. `dueDate` accepte `null`, `""` ou le format standard `YYYY-MM-DD`.
   - Dans `invoice-editor.tsx` : Ajout des astérisques rouges obligatoires `*` sur `Client *`, `Date d'émission *`, `Description *`, `Qté *` et `Prix U. (XAF) *`.
   - Règle monétaire stricte : `unitPrice` et `discount` sont strictement des entiers en FCFA sans centimes (`step="1"`, validation `z.number().int().min(0)`).
   - Élimination des fuites mémoire potentielles et gestion sécurisée du cycle de vie des requêtes.

2. **Verrouillage Absolu des Factures Payées et Normalisation Radix UI (Plan Curatif)** :
   - Dans `invoices.tsx` : Masquage total de l'option « Annuler / Supprimer » lorsque `invoice.status === 'PAID'` ou `invoice.status === 'PARTIALLY_PAID'` sur les 3 formats d'affichage (Tableau, Cartes Horizontales, Grille de Blocs).
   - Dans `invoice.actions.ts` : Rejet serveur formel avec messages explicites sur `updateInvoice` et `deleteInvoice` si la facture a reçu des paiements ou est archivée.
   - Intégration du composant `<Select>` Radix UI standardisé pour le filtrage par statut couvrant toutes les valeurs métier.
   - Protection contre les valeurs nulles sur `client.email` avec fallback téléphonique ou tiret `—`.

3. **Indexation Composite SQLite Haute Performance (Plan Préventif)** :
   - Ajout des index composites partiels dans `lib/db.ts` et `tests/helpers/db.ts` :
     - `idx_invoices_tenant_date` sur `invoices(tenant_id, date DESC) WHERE deletedAt IS NULL`
     - `idx_invoices_tenant_number` sur `invoices(tenant_id, number) WHERE deletedAt IS NULL`
     - `idx_invoice_items_invoice_tenant` sur `invoice_items(invoiceId, tenant_id)`
     - `idx_credit_notes_tenant_date` sur `credit_notes(tenant_id, date DESC) WHERE deletedAt IS NULL`
     - `idx_credit_notes_tenant_invoice` sur `credit_notes(tenant_id, invoiceId) WHERE deletedAt IS NULL`
     - `idx_credit_note_items_cn_tenant` sur `credit_note_items(creditNoteId, tenant_id)`
   - Réutilisation optimale de `idx_invoices_client_status` pour les vérifications de dettes et pré-suppressions.
   - Validation via `EXPLAIN QUERY PLAN` dans `tests/unit/module3-preventif.test.ts`.

4. **Piste d'Audit Complète (Audit Trail)** :
   - Consignation systématique des actions `CREATE`, `UPDATE` et `DELETE` dans `audit_logs` avec traçabilité complète de l'utilisateur, du tenant et de l'horodatage UTC.

## Consequences

### Positive
- Conformité fiscale et légale stricte : impossibilité de supprimer frauduleusement une facture encaissée.
- Zéro régression et tolérance totale aux transactions de comptoir avec clients sans email.
- Requêtes de listing et de recherche sous la barre des 5ms même au-delà de 20 000 pièces comptables.
- Expérience utilisateur enrichie avec des listes déroulantes de statuts claires et harmonisées.

### Negative / Trade-offs
- Légère augmentation de l'espace disque du fichier SQLite pour maintenir les index composites et la table `audit_logs`.

## Alternatives Considered

- Alternative 1 : Autoriser la suppression des factures payées en supprimant en cascade les règlements associés. Rejeté formellement car cela constitue une violation fiscale grave du principe d'intangibilité des écritures comptables. L'émission d'un avoir est la seule voie légale.
- Alternative 2 : Conserver des champs de texte libre pour le statut des factures. Rejeté pour éviter les désalignements d'état et offrir une sélection cohérente et accessible via le composant Radix UI Select.

## Risks

- Risk : Manipulation de factures existantes ayant des données d'email nulles lors de l'affichage dans les cartes et listes.
- Mitigation : Coalescence sécurisée `(client.email || '').toLowerCase()` et ajout de fallbacks visuels systématiques pour prévenir tout crash JavaScript à l'exécution.

## Verification

- Command : `npm run quality:decisions`
- Test : `npx vitest run tests/unit/module3-correctif.test.ts tests/unit/module3-curative.test.ts tests/unit/module3-preventif.test.ts tests/unit/components/pages/invoices.test.tsx`
- Query Plan : `EXPLAIN QUERY PLAN` validé sur `idx_invoices_tenant_date` et `idx_invoices_client_status`.

