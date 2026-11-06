# ADR-0054: Réorganisation Optimisée de la Navigation Latérale (Standards SaaS/ERP)

## Status

Accepted

## Scope

- Area: apps/desktop
- Library or platform: React 19, Next.js 16, Lucide React, Radix UI, Vitest, TypeScript
- Installed version: Next.js 16.0.0, Electron 34.0.0, Lucide-React 0.474.0
- Related files:
  - `apps/desktop/components/layout/navigation.tsx`
  - `apps/desktop/components/layout/command-menu.tsx`
  - `apps/desktop/tests/unit/desktop-phase2-curatif.test.ts`
  - `apps/desktop/tests/unit/rbac-and-password.test.ts`
  - `apps/desktop/tests/unit/ledger-ui-wiring.test.ts`

## Documentation Source

- Context7 source: Ergonomie SaaS ERP, Loi de Miller (7±2 chunks), Loi de Fitts
- Official fallback source: Nielsen Norman Group (Information Architecture & Navigation Menus)
- Date checked: 2026-11-04

## Context

L'ancienne organisation de la barre latérale regroupait de façon hétérogène dans un seul bloc « Pilotage & Ventes » des fonctionnalités de reporting global (Dashboard), de trésorerie quotidienne (Livre des comptes) et l'ensemble des documents de vente (Factures, Devis, Avoirs). De plus, l'intitulé « Avoirs & Remboursements » était sujet à une troncature visuelle dans la barre latérale à 260px ou rétractée, et le terme « Gouvernance » était moins intuitif que les standards actuels des logiciels ERP/SaaS.

## Decision

1. **Actions Rapides (En haut)** : Conservation des deux boutons primaires d'action immédiate selon la Loi de Fitts :
   - `+ Nouveau devis` (bouton primaire plein).
   - `+ Nouvelle facture` (bouton contouré blanc/bordure).
2. **PILOTAGE & TRÉSORERIE (`group: 'pilotage'`)** :
   - `dashboard` : Tableau de bord
   - `ledger` : Livre des comptes (remonté pour former un pôle unifié de pilotage financier quotidien).
3. **VENTES & DOCUMENTS (`group: 'sales'`)** :
   - `invoices` : Factures (avec badge dynamique ambre/orange indiquant le nombre de factures impayées/en retard).
   - `quotes` : Devis (avec badge dynamique des devis en attente).
   - `credit-notes` : Avoirs (libellé raccourci pour éliminer toute troncature visuelle et s'aligner sur la terminologie ERP).
4. **RÉFÉRENTIEL (`group: 'repository'`)** :
   - `clients` : Clients
   - `services` : Services
   - `stock` : Gestion de stock (icône sémantique `Package`).
5. **ADMINISTRATION & SÉCURITÉ (`group: 'admin'`)** :
   - `users` : Utilisateurs
   - `audit` : Journal d'audit
6. **Pied de page (`group: 'bottom'`)** :
   - `settings` : Paramètres
   - Bouton de déconnexion sécurisé (rouge avec dialogue de confirmation modal).

## Alternatives Considered

- *Conserver la structure à 3 blocs*: Rejeté car cela mélangeait la supervision de trésorerie avec la saisie de facturation commerciale, créant une surcharge cognitive.
- *Garder l'intitulé étendu 'Avoirs & Remboursements'*: Rejeté car source de troncature visuelle ('Avoirs & Rembou...') sur les résolutions standard.

## Risks

- *Désalignement avec la palette de commandes globale*:
  - *Mitigation*: Mise à jour simultanée des raccourcis et catégories dans `CommandMenu` (`command-menu.tsx`).

## Verification

- Command: `npx tsc --noEmit --project apps/desktop/tsconfig.json` (0 erreur)
- Test: `npm run test --workspace=facturier-desktop -- tests/unit/desktop-phase2-curatif.test.ts tests/unit/rbac-and-password.test.ts tests/unit/ledger-ui-wiring.test.ts tests/unit/stock-management.test.ts` (20/20 tests passés)
- Decisions: `npm run quality:decisions` (54 fiches valides).
