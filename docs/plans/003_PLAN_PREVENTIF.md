# 003 - PLAN PRÉVENTIF (SCALABILITÉ & GOUVERNANCE)

Cette feuille de route s'attaque aux problèmes structurels qui empêcheront l'application Facturier de fonctionner de manière fluide lorsqu'elle dépassera les 10 000 ou 50 000 enregistrements (Scalabilité SQLite & RAM Client).

## 1. Architecture de Recherche Paginée (Server-Side)

**Problème Actuel** : Le `CommandMenu` (raccourci Ctrl+K) et le `DataSync` chargent l'entièreté des tables `invoices`, `quotes`, et `clients` en RAM (Zustand) et effectuent des `Array.filter()` JavaScript. Au-delà de 2000 lignes, cela provoque du Memory Bloat et un blocage du Thread UI (Jank).

**Solution Architecturale** :
1.  **Création d'une Omnibar Action** :
    Créer un endpoint `searchOmnibar(query: string)` dans une nouvelle action (ex: `apps/desktop/app/actions/search.actions.ts`).
    ```sql
    -- Requête Unifiée Rapide :
    SELECT id, number as title, 'invoice' as type FROM invoices WHERE number LIKE ? OR clientName LIKE ?
    UNION ALL
    SELECT id, name as title, 'client' as type FROM clients WHERE name LIKE ?
    LIMIT 10;
    ```
2.  **Debounce côté Client** :
    Dans `command-menu.tsx`, introduire un debounce (ex: 300ms via `use-debounce`) sur la valeur de recherche.
    La recherche ne se fera plus sur le store Zustand, mais via l'appel réseau vers l'action serveur.
3.  **Délestage du DataSync** :
    Le fichier `apps/desktop/components/data-sync.tsx` ne doit plus télécharger que les 50 dernières factures et devis au montage. L'historique complet sera chargé uniquement si l'utilisateur visite les pages dédiées et demande la page suivante.

## 2. Optimisation Index SQLite (Migrations V4)

**Problème Actuel** : Le `MetricsRepository` (qui alimente le Dashboard et la Sidebar) effectue des filtres lourds (`status IN (...)`, `deletedAt IS NULL`, fonctions de dates `strftime`) sans index adaptés à ces agrégations.

**Solution Architecturale** :
Générer un fichier de migration SQLite (`apps/desktop/lib/db/migrations/0004_performance_indexes.ts`).
```sql
-- Création d'index composites pour accélérer les vues filtrées
CREATE INDEX idx_invoices_status_deleted ON invoices(status, deletedAt) WHERE deletedAt IS NULL;
CREATE INDEX idx_quotes_status_deleted ON quotes(status, deletedAt) WHERE deletedAt IS NULL;
CREATE INDEX idx_payments_invoiceId_date ON payments(invoiceId, date DESC);
```

## 3. Synchronisation Cloud Non-Bloquante

**Problème Actuel** : L'itération synchrone (une table après l'autre via `await`) dans `CloudSyncService.ts` ralentit drastiquement la synchronisation, causant des lenteurs perçues par l'utilisateur.

**Solution Architecturale** :
Refactoriser `CloudSyncService.ts` pour paralléliser la synchronisation des tables indépendantes (qui n'ont pas de contrainte de clé étrangère entre elles).
```typescript
// Exemple de parallélisation (Push)
const baseTables = SYNC_TABLES.filter(c => !c.local.includes('items'));
const itemTables = SYNC_TABLES.filter(c => c.local.includes('items'));

// 1. Sync des tables maîtresses
await Promise.allSettled(baseTables.map(cfg => pushTable(sb, cfg, ctx.tenantId, report)));
// 2. Sync des enfants
await Promise.allSettled(itemTables.map(cfg => pushTable(sb, cfg, ctx.tenantId, report)));
```
De plus, intégrer un mécanisme WebSocket (Supabase Realtime) au lieu du `setInterval` de 60 secondes. L'application ne synchronisera que lorsque le canal de broadcast annoncera une modification sur le Cloud, économisant ainsi de la bande passante et de la batterie.

## 4. Gouvernance du Code (CI & ESLint)

**Problème Actuel** : L'utilisation silencieuse de `try { ... } catch (e) {}` et l'inclusion de types `any` dans des fichiers critiques comme `user.actions.ts`.

**Solution Architecturale** :
*   Configurer ESLint avec la règle `@typescript-eslint/no-explicit-any` en statut "Error" pour les dossiers `actions/` et `lib/api/`.
*   Appliquer la règle `@typescript-eslint/no-unused-vars` pour détecter les blocs catch muets (`catch (e) {}`).
*   Intégrer ces règles dans un hook de `pre-commit` (via *Husky* ou similaire) pour empêcher techniquement la dette de s'accumuler lors des prochains Lots.