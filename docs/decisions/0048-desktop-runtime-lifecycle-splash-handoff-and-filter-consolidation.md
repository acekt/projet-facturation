# ADR-0048: Durcissement du Cycle de Vie Electron, Transition Splash Sécurisée et Dédoublonnage des Filtres

## Status

Accepted

## Scope

- Area: Application Desktop (`apps/desktop`), Cycle de Vie Electron, Webpack Dev Cache Memory, SQLite Migrations, Filtres Factures
- Library or platform: facturier-desktop, Electron 40, Next.js 16 (Webpack), better-sqlite3, Vitest 4
- Installed version: facturier-desktop@1.0.0, turbo@2.11.9, vitest@4.1.11, electron@~40.4.1
- Related files:
  - `apps/desktop/main/window.js`
  - `apps/desktop/main/server.js`
  - `apps/desktop/package.json`
  - `apps/desktop/lib/db/migrateLegacy.ts`
  - `apps/desktop/components/pages/invoices/InvoiceFilterBar.tsx`
  - `apps/desktop/components/pages/invoices.tsx`
  - `apps/desktop/components/dashboard/admin.tsx`
  - `apps/desktop/vitest.config.ts`
  - `apps/desktop/tests/unit/components/pages/invoices.test.tsx`

## Documentation Source

- Context7 source: `/electron/electron`, `/vercel/next.js`
- Official fallback source: Electron Window Lifecycle Guide (`ready-to-show` vs `did-finish-load`), SQLite PRAGMA foreign_keys documentation
- Date checked: 2026-10-30

## Context

Durant l'exécution en mode développement (`npm run dev` + `npm run electron`), quatre dysfonctionnements bloquants ont été diagnostiqués à partir des journaux terminaux et des captures d'écran des processus :
1. **Écran Blanc Post-Splash (Violation du Seuil de Doherty et de la Règle de Nielsen)** :
   - `mainWindow.once('ready-to-show')` déclenchait la fermeture immédiate du splash screen dès l'initialisation du canevas Win32 natif (~50 ms), alors que le serveur Next.js 16 compilait la route `/` en arrière-plan pendant 12 à 16 secondes. L'utilisateur faisait face à un écran blanc vide et inerte pendant 15+ secondes.
2. **Crash DevTools OOM (`render-process-gone: -536870904`)** :
   - L'ouverture synchrone des outils de développement détachés sur une fenêtre non montée, couplée aux requêtes concurrentes de rechargement et à l'allocation des buffers Webpack, provoquait l'effondrement du processus de rendu Chromium.
3. **Erreur d'Allocation Mémoire Webpack PackFileCache** :
   - Le script `dev` ne spécifiait pas `--max-old-space-size=4096`, causant un dépassement de tas `RangeError: Array buffer allocation failed` lors de la sérialisation du cache Webpack.
4. **Erreur de Clé Étrangère SQLite lors de la Migration Legacy** :
   - `migrateLegacy.ts` échouait avec `SqliteError: FOREIGN KEY constraint failed` car `PRAGMA foreign_keys` était actif lors du remappage atomique des identifiants des tables parentes (`clients`) vers les tables enfants.
5. **Doublon Visuel et Ergonomique des Filtres de Statut** :
   - La coexistence d'un composant `<Select>` déroulant et d'une ligne de pilules de filtres rapides créait une redondance fonctionnelle et une confusion cognitive pour l'utilisateur.

## Decision

1. **Protocole de Transition Splash Sécurisé (`tryRevealMainWindow`)** :
   - Dans `apps/desktop/main/window.js`, la révélation de la fenêtre principale exige désormais la conjonction des deux états : `isReadyToShow === true` (canevas Chromium prêt) ET `isContentLoaded === true` (événement `did-finish-load` sur l'URL applicative).
   - Un fondu enchaîné de sécurité de 150 ms garantit que le splash ne se referme qu'une fois le DOM React effectivement peint.
   - L'attachement des DevTools détachés est reporté après la révélation réussie de la fenêtre.
2. **Préchauffage Transparent de la Route Racine (`warmupRoot`)** :
   - Dans `apps/desktop/main/server.js`, pendant la phase d'animation du splash screen, Electron déclenche un `GET` silencieux sur `http://127.0.0.1:3000/`. Next.js compile ainsi la page de connexion / dashboard pendant que la barre de progression progresse, permettant une transition instantanée (< 50 ms) à l'ouverture.
3. **Allocation Mémoire Node.js Durcie** :
   - Le script `"dev"` dans `package.json` est harmonisé avec `cross-env NODE_OPTIONS="--max-old-space-size=4096"`.
4. **Transactions de Migration SQLite Sûres avec Débrayage Temporaire des Contraintes FK** :
   - Dans `migrateLegacy.ts`, l'exécution du remappage est encadrée par `db.pragma('foreign_keys = OFF');` avec restauration garantie dans un bloc `finally` de `db.pragma('foreign_keys = ON');`.
5. **Consolidation Sémantique des Filtres Factures** :
   - Retrait du menu `<Select>` redondant dans `InvoiceFilterBar.tsx` au profit exclusif des pilules d'accès direct (Fitts & Hick) colorées selon les conventions fintech (`Toutes`, `À encaisser`, `Payées`, `En retard`, `Annulées`), avec détection dynamique des échéances dépassées.

## Alternatives Considered

- *Alternative 1 (Polling de l'état React via IPC)* : L'envoi d'un message IPC `app:ready` depuis `layout.tsx` a été écarté pour éviter un couplage fort entre le code frontend Next.js et le processus principal Electron.
- *Alternative 2 (Conserver le menu déroulant de statut)* : Écarté pour respecter la loi de Hick et éliminer les doubles états d'interface concurrents.

## Risks

- *Risque* : Blocage du splash screen si le serveur HTTP local ne répond jamais au préchauffage.
- *Atténuation* : Timeout strict de 3000 ms avec gestion gracieuse d'erreur (`warmupRoot` non bloquant).

## Verification

- Command: `npm run quality:decisions` (48/48 fiches valides).
- Command: `npm run quality:desktop-health` (147/147 fichiers conformes à la règle M-400).
- Command: `npm run typecheck -- --force` (0 erreur TypeScript dans le monorepo).
- Command: `npm run test --prefix apps/desktop` (55 suites de tests validées).

