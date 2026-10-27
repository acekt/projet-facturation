# ADR-0032: Cycle de Vie, Verrouillage des Devis Convertis, Indexation Composite et Piste d'Audit (Module 2)

## Status

Accepted

## Scope

- Area: apps/desktop, packages/database
- Library or platform: SQLite (better-sqlite3), PowerSync Client SDK, Next.js 16 Server Actions, Radix UI Select
- Installed version: Next.js 16.4.3, better-sqlite3 12.6.2, @radix-ui/react-select 2.1.6
- Related files:
  - `apps/desktop/lib/db.ts`
  - `apps/desktop/lib/validations.ts`
  - `apps/desktop/app/actions/quote.actions.ts`
  - `apps/desktop/lib/services/QuoteService.ts`
  - `apps/desktop/components/pages/quotes.tsx`
  - `apps/desktop/components/pages/quote-editor.tsx`
  - `apps/desktop/tests/unit/module2-correctif.test.ts`
  - `apps/desktop/tests/unit/module2-curative.test.ts`
  - `apps/desktop/tests/unit/module2-preventif.test.ts`

## Documentation Source

- Context7 source: SQLite Partial Indices & Expression Optimization (`https://www.sqlite.org/partialindex.html`), Radix UI Select Accessibility & Controlled States (`https://www.radix-ui.com/primitives/docs/components/select`)
- Official fallback source: `node_modules/next/dist/docs/`
- Date checked: 2026-10-27

## Context

Le Module 2 (Gestion des Devis / Propositions Commerciales & Proformas) assure l'émission, le suivi et la conversion des propositions commerciales en factures officielles. Plusieurs fragilités fonctionnelles, techniques et de gouvernance ont été identifiées :
1. **Tolérance aux clients sans email et flexibilité des dates** :
   - Le schéma de validation `quoteSchema` rejetait les devis émis pour des clients de comptoir ou artisans sans adresse email (`Expected string, received null`).
   - L'absence ou l'effacement de la date de validité `validUntil` déclenchait un rejet regex car le composant transmettait une chaîne vide `""`.
2. **Verrouillage comptable des devis convertis (`CONVERTI`)** :
   - Lorsqu'un devis était converti en facture, l'action « Supprimer » restait visible et déclenchable dans l'interface utilisateur pour les trois modes d'affichage (Tableau, Cartes Horizontales, Grille de Blocs).
   - Les modifications ou suppressions côté serveur devaient être formellement rejetées pour garantir l'immutabilité de la pièce source ayant donné naissance à la facture.
3. **Ergonomie des listes déroulantes de filtrage de statut** :
   - L'écran de liste utilisait des boutons plats partiels qui ignoraient les statuts `ENVOYE` et `REFUSE`. L'absence d'un composant de sélection unifié limitait la vision opérationnelle.
4. **Performance sous forte volumétrie (10 000+ devis)** :
   - Les tris par date décroissante, les recherches par numéro séquentiel et les jointures de lignes d'articles `quote_items` risquaient de dégrader les temps de réponse sans indexation composite multi-tenant.

## Decision

1. **Assouplissement et Signalétique Visuelle des Champs (Plan Correctif)** :
   - Dans `lib/validations.ts` : `clientEmail` accepte `null`, `""` ou une adresse email valide. `validUntil` accepte `null`, `""` ou le format standard `YYYY-MM-DD`.
   - Dans `quote-editor.tsx` : Ajout des astérisques rouges obligatoires `*` sur `Client *`, `Date d'émission *`, `Description *`, `Qté *` et `Prix U. (XAF) *`.
   - Règle monétaire stricte : `unitPrice` et `discount` sont strictement des entiers en FCFA sans centimes (`step="1"`, validation `z.number().int().min(0)`).
   - Élimination d'un parasite `AbortController` orphelin dans `quote-editor.tsx` remplacé par un drapeau `isMounted`.

2. **Verrouillage Absolu des Devis Convertis et Normalisation Radix UI (Plan Curatif)** :
   - Dans `quotes.tsx` : Masquage total de l'option « Supprimer » lorsque `quote.status === 'CONVERTI'` sur les 3 formats d'affichage.
   - Dans `quote.actions.ts` : Rejet serveur formel avec messages explicites sur `updateQuote` et `deleteQuote` si le devis est converti.
   - Dans `QuoteService.ts` : Garantie d'idempotence contre la double-conversion concurrente.
   - Remplacement des boutons plats par un composant `<Select>` Radix UI standardisé couvrant tous les statuts métier (`all`, `EN_ATTENTE`, `ENVOYE`, `CONVERTI`, `REFUSE`, `EXPIRE`).
   - Extension du filtre de recherche textuelle à l'objet du devis (`subject`).

3. **Indexation Composite SQLite Haute Performance (Plan Préventif)** :
   - Ajout des index composites partiels dans `lib/db.ts` et `tests/helpers/db.ts` :
     - `idx_quotes_tenant_date` sur `quotes(tenant_id, date DESC) WHERE deletedAt IS NULL`
     - `idx_quotes_tenant_client` sur `quotes(tenant_id, clientId) WHERE deletedAt IS NULL`
     - `idx_quotes_tenant_status` sur `quotes(tenant_id, status) WHERE deletedAt IS NULL`
     - `idx_quotes_tenant_number` on `quotes(tenant_id, number) WHERE deletedAt IS NULL`
     - `idx_quote_items_quote_tenant` on `quote_items(quoteId, tenant_id)`

4. **Étanchéité Multi-Tenant et Traçabilité Complète** :
   - Isolation étanche de toutes les requêtes de lecture, mise à jour et suppression au `tenant_id` actif résolu depuis la session.
   - Émission systématique d'événements d'audit immuables (`CREATE`, `UPDATE`, `DELETE`, `CONVERT`) dans `audit_logs`.

## Alternatives Considered

- Alternative 1 : Autoriser la suppression logique (`softDelete`) des devis convertis. Rejeté car un devis converti est le justificatif contractuel initial lié à une facture active ; sa suppression créerait une rupture de continuité dans la piste d'audit comptable.
- Alternative 2 : Conserver des boutons plats pour le filtrage de statuts. Rejeté pour des raisons de densité d'information et d'encombrement mobile/desktop ; le composant Radix UI Select offre une accessibilité complète et une cohérence visuelle avec le Design System de l'application.

## Risks

- Risk : Comportement des devis historiques ayant un `clientEmail` vide ou nul lors de la conversion.
- Mitigation : `QuoteService.convertToInvoice` tolère nativement `clientEmail: null` et transfère la valeur en base de données sans blocage, tandis que `DocumentA4` et le moteur PDF masquent automatiquement la ligne email si elle est absente.

## Verification

- Command : `npm run quality:decisions`
- Test : `npx vitest run tests/unit/module2-correctif.test.ts tests/unit/module2-curative.test.ts tests/unit/module2-preventif.test.ts`
- Query Plan : `EXPLAIN QUERY PLAN` validé sur `idx_quotes_tenant_date` et `idx_quotes_tenant_status`.
