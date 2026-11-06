# ADR-0065: Invoice Cancelled Badge Clarity and Design System Pagination Stability

## Status

Accepted

## Scope

- Area: Invoice Card & List Views, Design System Pagination Stability across Lists
- Library or platform: Next.js 16, React 19, Tailwind CSS, Lucide React
- Installed version: next 16.0.0, react 19.0.0
- Related files:
  - `apps/desktop/components/pages/invoices/InvoiceViews.tsx`
  - `apps/desktop/components/pages/invoices.tsx`
  - `apps/desktop/components/pages/quotes.tsx`
  - `apps/desktop/components/pages/credit-notes.tsx`
  - `apps/desktop/components/pages/stock.tsx`
  - `apps/desktop/components/pages/ledger.tsx`
  - `apps/desktop/components/pages/audit-logs.tsx`
  - `packages/ui/src/components/pagination-custom.tsx`
  - `apps/desktop/tests/unit/invoices-pagination-and-cancelled-badge.test.tsx`

## Documentation Source

- Context7 source: `/radix-ui/primitives`, `/vercel/next.js`
- Official fallback source: React 19 UI component patterns, Tailwind CSS Design System standards
- Date checked: 2026-11-05

## Context

1. **Clarté du statut des factures annulées ou soldées par un avoir** :
   - Dans `InvoiceViews.tsx`, une facture annulée ou dont le solde restant est ramené à zéro via un avoir pouvait afficher un badge ambigu pouvant induire en erreur les utilisateurs opérationnels qui la confondaient avec une facture normalement encaissée (`Soldé`).
   - Il était requis d'afficher explicitement le badge `"Annulée (Avoir)"` avec un code couleur distinctif (bordure et pastille rose/rouge) dès que la facture a le statut annulé ou est couverte par un avoir.
2. **Stabilité du pied de page de pagination** :
   - Dans `packages/ui/src/components/pagination-custom.tsx`, le composant retournait `null` lorsque `totalPages <= 1`.
   - Cela entraînait une disparition brutale de la barre de pagination lors du filtrage ou du changement d'onglet (par exemple lorsqu'une vue ne contenait que quelques lignes ou 1 seule page), provoquant un saut visuel (layout shift) désagréable dans les vues Factures, Devis, Avoirs, Stock et Grand Livre.
   - La barre de pagination doit demeurer visible en permanence (`Page 1 sur 1`) avec les boutons de navigation désactivés afin de maintenir un cadre de lecture rigoureusement stable.

## Decision

1. **Badge Explicite "Annulée (Avoir)" dans `InvoiceViews.tsx`** :
   - La fonction `getPaymentBadge` vérifie si `isCancelled` est vrai ou si `ps.settledByCreditNote` est activé.
   - Dans ce cas, elle retourne systématiquement le badge dédié :
     `<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Annulée (Avoir)</span>`
   - Les factures normalement encaissées continuent d'afficher le badge d'encaissement effectif (`Soldé`).
2. **Pérennité de la Barre de Pagination dans `packages/ui/src/components/pagination-custom.tsx`** :
   - Suppression du `if (totalPages <= 1) return null`.
   - Sécurisation du calcul des bornes : `safeTotalPages = Math.max(1, totalPages || 1)` et `safeCurrentPage = Math.min(Math.max(1, currentPage || 1), safeTotalPages)`.
   - Le compteur affiche toujours `Page ${safeCurrentPage} sur ${safeTotalPages}` (ex: `Page 1 sur 1`).
   - Les boutons de pagination (`<<`, `<`, `>`, `>>`) sont désactivés avec `disabled={safeCurrentPage <= 1}` et `disabled={safeCurrentPage >= safeTotalPages}`.
3. **Harmonisation des pages de listes** :
   - Les pages `invoices.tsx`, `quotes.tsx`, `credit-notes.tsx`, `stock.tsx`, `ledger.tsx` et `audit-logs.tsx` conservent ainsi un conteneur de pagination stable et prévisible quel que soit le volume de résultats filtrés.

## Alternatives Considered

- Masquer la pagination lorsque la liste est courte : Rejeté car cela provoquait des sauts d'interface (layout shift) lors du changement d'onglet ou de filtre de recherche.
- Conserver le statut "Soldé" pour les factures couvertes par avoir : Rejeté pour des raisons comptables et d'audit, car une facture neutralisée par un avoir n'a pas généré de flux financier réel de paiement.

## Risks

- Aucun impact négatif : les événements `onPageChange` ne sont pas déclenchés lorsque les boutons sont désactivés.

## Verification

- Command: `npx tsc --noEmit --project apps/desktop/tsconfig.json`
- Test: `npx vitest run apps/desktop/tests/unit/invoices-pagination-and-cancelled-badge.test.tsx --config apps/desktop/vitest.config.ts`
- Decision Quality: `npm run quality:decisions`

