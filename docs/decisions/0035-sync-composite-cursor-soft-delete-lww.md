# ADR-0035: Synchronisation Multi-Postes — Curseur Composite, Soft-Delete des Lignes et Garde LWW

## Status

Accepted

## Scope

- Area: Synchronisation Multi-Postes Desktop <-> Cloud, Pull/Push Engine, Conflits LWW, Intégrité des Articles
- Library or platform: Supabase PostgREST, better-sqlite3, SQLite WAL
- Installed version: @supabase/supabase-js 2.117.3, better-sqlite3 12.10.0
- Related files:
  - `apps/desktop/lib/sync/CloudSyncService.ts`
  - `apps/desktop/lib/sync/localSchema.ts`
  - `apps/desktop/app/actions/quote.actions.ts`
  - `apps/desktop/lib/repositories/QuoteRepository.ts`
  - `apps/desktop/lib/repositories/InvoiceRepository.ts`
  - `apps/desktop/tests/integration/sync-two-devices.test.ts`
  - `supabase/migrations/20261028_correctif_sync_lww_and_kpis.sql`

## Documentation Source

- Context7 source: `/supabase/postgrest-js` (PostgREST complex `.or()` with nested `and(...)` filtering, multiple column ordering)
- Official fallback source: Supabase PostgREST Documentation & PowerSync conflict resolution guidelines
- Date checked: 2026-10-28

## Context

Dans une topologie multi-postes (plusieurs caisses Desktop synchronisées sur un même tenant Supabase), quatre anomalies majeures menaçaient l'intégrité des données :
1. **Perte de lignes au Pull (D1)** : Le curseur `pullTable` utilisait uniquement `.gt('server_updated_at', cursor)`. Lorsque plusieurs centaines de lignes étaient insérées dans une même transaction ou partageaient le même horodatage serveur, toute ligne située après la première page était ignorée définitivement.
2. **Destruction d'articles et fantômes de synchronisation (D2)** : La modification d'un devis exécutait un `DELETE FROM quote_items WHERE quoteId = ?` brutal suivi de recréation intégrale avec de nouveaux UUIDs. Ceci générait des tombstones intempestifs et écrasait les données sans diff.
3. **Dérive d'horloge et écrasement LWW (D3)** : Si l'horloge d'un poste dérivait (par exemple de +2 heures), un `updated_at` dans le futur écrasait systématiquement les modifications légitimes plus récentes des autres postes.
4. **Blocage de la file d'envoi (A4)** : Une ligne en échec de contrainte bloquait ou retentait indéfiniment sans trace pérenne.

## Decision

Nous mettons en œuvre les quatre corrections d'intégrité prévues au Lot A du Plan Correctif :

1. **Curseur Composite Strict `(server_updated_at, id)`** :
   - Le curseur stocké dans `sync_meta` devient un objet composite `{ ts: string, id: string }` avec rétrocompatibilité totale pour les anciens horodatages ISO.
   - La requête Supabase applique un ordre total strict :
     `.order('server_updated_at', { ascending: true }).order(cfg.remotePk, { ascending: true })`
   - Le filtre PostgREST combine l'avancement :
     `.or('server_updated_at.gt.TS,and(server_updated_at.eq.TS,id.gt.ID)')`
   - Index composite cloud dédié : `idx_<t>_sync2 (tenant_id, server_updated_at, id)`.

2. **Soft Delete et Diff par ID des Articles (D2)** :
   - Ajout d'une colonne `deletedAt` sur `quote_items`, `invoice_items` et `credit_note_items`.
   - Lors de la modification d'un devis, suppression du `DELETE` physique : mise à jour in-place des lignes conservées via leur ID, insertion des nouvelles, et marquage `deletedAt = now()` sur les lignes retirées.
   - Toutes les lectures d'items filtrent systématiquement `(deletedAt IS NULL OR deletedAt = '')`.

3. **Garde-Fou LWW & Mesure de Dérive d'Horloge (D3)** :
   - Le serveur Supabase applique la fonction trigger `sync_lww_guard()` : tout horodatage supérieur à `now() + interval '5 minutes'` est ramené à l'heure serveur, et les écritures avec `updated_at` antérieur à la ligne existante sont ignorées.
   - Côté Desktop, `measureClockDrift()` compare l'en-tête HTTP `Date` de Supabase avec `Date.now()`. Une alerte technique est levée si la dérive dépasse 120 secondes.

4. **Table de Quarantaine des Erreurs `sync_failures` (A4)** :
   - Les échecs unitaires de poussée ou de tirage sont enregistrés dans `sync_failures(table_name, record_id, error, attempts, last_attempt_at)`.
   - Après 5 échecs consécutifs sur un même enregistrement, la ligne est mise en quarantaine pour ne pas bloquer les autres transactions de la file.

## Alternatives Considered

- Réplication PowerSync totale sans code custom : nécessite un service intermédiaire hébergé dédié non encore configuré en production. Le protocole LWW + curseur composite actuel assure la robustesse immédiate en local-first.
- Suppression physique avec tombstones seuls pour les items : provoque des boucles de tombstones et la perte d'historique comptable. Le soft-delete uniforme est aligné sur la politique globale du projet.

## Risks

- Augmentation du volume de la table `quote_items` avec le temps due au soft-delete.
- Mitigation : index partiels `WHERE deletedAt IS NULL` pour maintenir des performances de lecture constantes en mémoire locale.

## Verification

- Command: `npx vitest run tests/integration/sync-two-devices.test.ts`
- Test: S-A1 (1500 lignes tirées au même horodatage sans perte), S-A2 (soft delete sans fantômes), S-A3 (compatibilité curseurs), S-A4 (quarantaine).
- Manual check: Vérification de l'absence de `DELETE FROM quote_items` dans `quote.actions.ts`.
