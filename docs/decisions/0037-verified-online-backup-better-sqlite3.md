# ADR-0037: Sauvegarde Vérifiée en Ligne et Intégrité SQLite WAL

## Status

Accepted

## Scope

- Area: Sauvegarde locale, Résilience aux pannes, Mode SQLite WAL, Intégrité des données
- Library or platform: better-sqlite3 native backup API, Node.js fs
- Installed version: better-sqlite3 12.10.0
- Related files:
  - `apps/desktop/lib/backup.ts`
  - `apps/desktop/main.js`
  - `apps/desktop/lib/db/migrateLegacy.ts`
  - `apps/desktop/tests/unit/backup.test.ts`

## Documentation Source

- Context7 source: `/wiselibs/better-sqlite3` (`.backup(destination, [options]) -> promise`, `PRAGMA integrity_check`)
- Official fallback source: SQLite Online Backup API Documentation (`https://www.sqlite.org/backup.html`)
- Date checked: 2026-10-28

## Context

L'application Desktop utilise SQLite avec le journal WAL (`PRAGMA journal_mode = WAL`).
Dans ce mode, les écritures récentes résident temporairement dans le fichier `database.sqlite-wal` jusqu'au prochain point de contrôle (checkpoint).
Effectuer une simple copie de fichier à chaud (`fs.copyFileSync('database.sqlite', ...)`), comme le faisaient précédemment `main.js` et `migrateLegacy.ts` :
1. Ignore les écritures encore présentes dans le fichier `-wal`.
2. Risque de copier un fichier en cours d'écriture par le moteur, produisant une sauvegarde corrompue ou tronquée indétectable jusqu'à la tentative de restauration.

## Decision

Nous mettons en place le service de sauvegarde vérifiée conforme au Lot C (D5) du Plan Correctif :

1. **API Native de Sauvegarde en Ligne (`db.backup(dest)`)** :
   - Remplacement de tout appel à `copyFileSync` sur la base SQLite par l'API asynchrone native `await db.backup(dest)` de `better-sqlite3`.
   - L'opération s'exécute dans le processus Next.js qui détient la connexion en écriture, assurant une copie cohérente de toutes les pages (y compris les transactions WAL en cours).

2. **Contrôle d'Intégrité Immédiat (`PRAGMA integrity_check`)** :
   - Dès la fin de la sauvegarde, ouverture d'une connexion isolée en lecture seule sur le fichier créé pour exécuter `PRAGMA integrity_check`.
   - Si le résultat n'est pas `'ok'`, le fichier corrompu est immédiatement supprimé et une exception explicite est levée pour alerter l'utilisateur et les logs système.

3. **Politique de Rétention Automatisée (`pruneBackups`)** :
   - Conservation des 7 sauvegardes les plus récentes dans le répertoire de sauvegarde, avec nettoyage automatique des archives plus anciennes.

4. **Vérification Systématique lors des Migrations et au Démarrage** :
   - `migrateLegacy.ts` et `main.js` vérifient l'intégrité de toute copie de sauvegarde avant de procéder aux modifications de schéma.

## Alternatives Considered

- Exécuter un checkpoint forcé `PRAGMA wal_checkpoint(TRUNCATE)` suivi d'une copie de fichier : risque de blocage si des requêtes concurrentes sont en cours et n'offre aucune garantie d'intégrité après copie. L'API native `.backup()` est spécifiquement conçue par SQLite pour cet usage.
- Sauvegardes compressées en ZIP : complexité inutile sur les volumes actuels (< 50 Mo) ; la simplicité d'un fichier `.sqlite` directement vérifiable et restaurable est privilégiée.

## Risks

- Consommation d'espace disque si les sauvegardes s'accumulent sans purge.
- Mitigation : `pruneBackups(dir, 7)` exécuté automatiquement après chaque création.

## Verification

- Command: `npx vitest run tests/unit/backup.test.ts`
- Test: 3 tests unitaires validant la création intègre via `db.backup()`, la vérification `PRAGMA integrity_check = ok`, la rétention à 7 fichiers et le tri chronologique.
