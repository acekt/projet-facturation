# ADR-0050: Cohérence Métier BDD, Brouillons, Compteurs Sidebar, Francisation du Journal d'Audit et Transition Splash

## Status

Accepted

## Scope

- Area: Application Desktop (`apps/desktop`), Journal d'Audit, Filtres et Compteurs (Factures, Devis, Avoirs), Gestion des Brouillons (Drafts), Transition Splash Screen, Typage Dashboard Admin
- Library or platform: facturier-desktop, Electron 42, Next.js 16, better-sqlite3, Vitest 4
- Installed version: facturier-desktop@1.0.0, turbo@2.11.9, vitest@4.1.11, electron@42.11.2
- Related files:
  - `apps/desktop/main/window.js`
  - `apps/desktop/components/dashboard/admin.tsx`
  - `apps/desktop/components/pages/invoices.tsx`
  - `apps/desktop/components/pages/invoices/InvoiceFilterBar.tsx`
  - `apps/desktop/components/pages/invoices/InvoiceViews.tsx`
  - `apps/desktop/components/pages/quotes.tsx`
  - `apps/desktop/components/layout/navigation.tsx`
  - `apps/desktop/lib/utils/auditFormatter.ts`
  - `apps/desktop/components/pages/audit-logs.tsx`
  - `apps/desktop/scripts/seed_multiyear.ts`
  - `apps/desktop/lib/db/migrations/0002_schema_hardening.ts`

## Documentation Source

- Context7 source: `/electron/electron`, `/vercel/next.js`
- Official fallback source: OHADA Uniform Act on Commercial Invoicing, DGI Gabon, Electron IPC Guidelines
- Date checked: 2026-10-30

## Context

L'audit des retours utilisateurs et l'analyse visuelle des captures d'écran ont mis en lumière plusieurs incohérences ergonomiques, techniques et de design :
1. **Écran blanc transitoire après le splash et déconnexion DevTools ("Render process gone..")** :
   - Le timeout de garde de 4s révélait prématurément la fenêtre principale pendant la phase de compilation froide de Next.js, affichant un écran blanc non conforme à la psychologie du design.
   - L'ouverture automatique de DevTools en mode détaché (`mode: 'detach'`) provoquait une fenêtre d'erreur de reconnexion au redémarrage du processus.
2. **Incohérence des filtres de statut sur les Devis ("Envoyé" vs "Brouillons")** :
   - Un devis envoyé est fonctionnellement en attente de validation client (`EN_ATTENTE`). Le statut isolé "Envoyé" fragmentait les listes et créait une discordance entre le tableau de bord (qui comptait 4 devis en attente) et la page devis (qui affichait 0).
   - Les utilisateurs ont un besoin crucial de sauvegarder des documents en "Brouillon" (`draft` / `BROUILLON`) pour les finaliser plus tard.
3. **Absence de compteurs sur les onglets de filtres et sur la Sidebar** :
   - Factures et Devis n'affichaient que partiellement les totaux sur leurs pilules de filtrage.
   - La barre latérale n'indiquait aucun compteur pour les devis en attente ni pour les avoirs actifs.
4. **Troncature agressive de la colonne Client en vue tableau** :
   - Des noms comme "Airtel Gabon SA" ou "Kori Tech" étaient tronqués en "Airtel G...", "Kori Tec..." malgré un espace horizontal libre dans le tableau.
5. **Détails techniques bruts et anglicismes dans le Journal d'Audit** :
   - La page d'audit affichait des énumérations anglaises (`PAYMENT_CREATE`, `INVOICE_CREATE`, `Payment`, `Invoice`) et le JSON brut de l'événement (`{"action":"PAYMENT_CREATE","invoiceNumber":...}`), inadapté pour des utilisateurs francophones non techniques.
6. **Erreurs de typage dans `admin.tsx`** :
   - Incompatibilité de typage entre `DashboardAdminData` et `DashboardMetricsResponse` sur la propriété `revenueData`.

## Decision

1. **Suppression du statut "Envoyé" au profit des "Brouillons" (`draft`)** :
   - Remplacement de l'onglet "Envoyés" par "Brouillons" avec badge numérique réactif sur Devis et Factures.
   - Les devis avec statut `ENVOYE` ou `sent` sont consolidés avec `EN_ATTENTE` sous l'onglet "En attente".
   - Extension de la contrainte CHECK SQLite de la table `invoices` pour accepter `'draft'` et `'BROUILLON'`.
2. **Harmonisation complète des pilules de filtrage et compteurs réactifs** :
   - Tous les onglets affichent désormais leur compteur numérique :
     - Factures : `Toutes ({total})`, `Brouillons ({draft})`, `À encaisser ({unpaid})`, `Payées ({paid})`, `En retard ({overdue})`, `Annulées ({cancelled})`.
     - Devis : `Tous ({total})`, `Brouillons ({draft})`, `En attente ({pending})`, `Convertis ({converted})`, `Refusés / Expirés ({refusedExpired})`.
   - La barre de navigation latérale affiche les badges réactifs pour `Factures` (à encaisser), `Devis` (en attente) et `Avoirs & Remboursements` (avoirs actifs non annulés).
3. **Régulation de la transition Splash et DevTools** :
   - Le timeout de garde est porté à 15s en développement (8s en production), garantissant que la fenêtre principale n'est révélée qu'une fois le signal `app:report-ready` reçu depuis React avec le composant Login déjà monté.
   - L'ouverture de DevTools détaché est désactivée par défaut et conditionnée à `process.env.OPEN_DEVTOOLS === 'true'`.
4. **Correction du tableau des factures et grille 3x3** :
   - La colonne Client dispose d'une largeur minimale garantie `w-[260px] min-w-[200px]` évitant toute troncature prématurée.
   - La taille de page en vue grille est fixée à 9 éléments (multiple de 3) avec défilement automatique vers le haut au changement de page.
5. **Francisation et humanisation du Journal d'Audit** :
   - Création de `auditFormatter.ts` transformant les actions et entités en français naturel et badges chromatiques adaptés (`Encaissement validé`, `Création facture`, `Règlement`, etc.).
   - Le JSON technique est traduit en phrases descriptives claires pour les utilisateurs métier avec formatage monétaire `FCFA`.
6. **Résolution du diagnostic TypeScript** :
   - Cast de `DashboardAdminData` vers `DashboardMetricsResponse` dans `admin.tsx`.
   - Maintien strict de la règle M-400 (< 400 lignes par fichier).

## Alternatives Considered

- Maintien du statut "Envoyé" comme filtre distinct : Rejeté car source de confusion pour les opérateurs OHADA et désynchronisation avec le tableau de bord.
- Rendu du JSON brut dans un accordéon pliable dans l'audit : Rejeté car les utilisateurs finaux francophones non techniques ont besoin d'une lecture narrative immédiate.

## Risks

- Risk: Les anciennes bases SQLite existantes sans `'draft'` dans le CHECK constraint d'invoices pourraient rejeter les insertions de brouillons.
- Mitigation: La migration met à jour le schéma et le script de seed intègre la définition étendue sans perte de données.

## Verification

- Command: `npm run typecheck`, `node scripts/check-desktop-health.mjs`, `node scripts/check-decision-records.js`
- Test: Suite de tests unitaires et d'intégration Vitest (`npm test --prefix apps/desktop`)
- Manual check: Navigation dans Factures (vue bloc 3x3 sans trous, vue tableau sans troncature client), Devis (onglet Brouillons et En attente réactifs), Journal d'audit (actions en français, détails lisibles sans JSON brut).
