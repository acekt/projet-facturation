# ADR-0020: Desktop Standalone Packaging, NSIS Distribution, and Electron Auto-Updater

## Status

Accepted

## Scope

- Area: Desktop Packaging, Electron Runtime, Next.js Standalone Build, NSIS Installer, Auto-Updater
- Library or platform: Electron 35, electron-builder ^25.1.8, electron-updater ^6.3.9, Next.js 16
- Installed version: electron ^35.0.0, electron-builder ^25.1.8, electron-updater ^6.3.9, next 16.0.0
- Related files:
  - `apps/desktop/main.js`
  - `apps/desktop/preload.js`
  - `apps/desktop/package.json`
  - `apps/desktop/next.config.mjs`
  - `apps/desktop/scripts/prepare-standalone.js`
  - `apps/desktop/types/electron.d.ts`
  - `apps/desktop/components/features/settings/UpdateManager.tsx`
  - `apps/desktop/components/pages/settings.tsx`
  - `apps/desktop/tests/unit/phase3-packaging-autoupdater.test.ts`

## Documentation Source

- Context7 source: `/electron-userland/electron-builder` (autoUpdater API, lifecycle events, and NSIS target options)
- Official fallback source: https://www.electron.build/auto-update
- Date checked: 2026-10-22

## Context

Dans l'architecture Hub & Spoke du Facturier :
1. **Packaging autonome en production** : L'application Desktop doit être installable sur n'importe quel poste Windows sans exiger de pré-requis technique (ni Node.js, ni Git, ni Python, ni dépendances externes installées sur la machine client).
2. **Compatibilité Next.js Standalone & Monorepo** : Next.js génère un serveur Node.js autonome via `output: 'standalone'` dans `.next/standalone`. En structure monorepo (Turborepo), les fichiers peuvent être placés à la racine de `.next/standalone` ou dans `.next/standalone/apps/desktop`. Il est impératif que le processus Electron résolve dynamiquement le point d'entrée `server.js` sans dépendre d'un chemin codé en dur.
3. **Chargement des binaires natifs (`better-sqlite3`)** : Le moteur SQLite local utilise un binaire compilé (`better_sqlite3.node`). Les bibliothèques dynamiques natives ne peuvent pas être chargées directement depuis une archive `.asar` compressée sous Windows.
4. **Maintenance & Distribution continue** : Les postes de caisse et comptables doivent pouvoir recevoir de manière transparente les correctifs logiciels et mises à jour de sécurité via un canal de distribution certifié (GitHub Releases ou Cloud storage), avec contrôle visuel par l'utilisateur.

## Decision

1. **Résolution Dynamique du Serveur Standalone (`resolveStandaloneServer`)** :
   - Mise en œuvre dans `main.js` d'une recherche ordonnée parmi les emplacements potentiels (`.next/standalone/server.js`, `.next/standalone/apps/desktop/server.js`, `resources/app.asar.unpacked/...`, `resources/standalone/...`).
   - Lancement du serveur Next.js via `utilityProcess.fork` en transmettant `ELECTRON_USERDATA_PATH` pour garantir que SQLite et le cache s'écrivent dans `AppData/Roaming/Facturier` (toujours accessible en écriture).
   - Adaptation du script `prepare-standalone.js` pour copier automatiquement les assets statiques (`public/` et `.next/static/`) vers les cibles standalone racines et imbriquées.

2. **Configuration de Packaging `electron-builder` & Installateur NSIS** :
   - Inclusion des binaires natifs dans `asarUnpack: ["**/*.node"]` afin que Windows puisse charger `better_sqlite3.node` sans extraction manuelle.
   - Cible NSIS pour Windows x64 avec `oneClick: true`, `perMachine: false`, raccourcis Bureau et Menu Démarrer, et nommage d'artefact normalisé `${productName}-Setup-${version}.${ext}`.

3. **Intégration de l'Auto-Updater Electron (`electron-updater`)** :
   - Initialisation dans `main.js` avec canal de publication GitHub Releases (`owner: acekt`, `repo: projet-facturation`).
   - Mode `autoDownload: false` pour laisser l'utilisateur décider du moment du téléchargement et éviter toute consommation réseau intempestive en journée de facturation.
   - Transmission des événements du cycle de vie vers l'interface de rendu : `updater:status` (`checking`, `available`, `not-available`, `downloaded`, `error`) et `updater:progress` (`percent`, `bytesPerSecond`).
   - Exposition d'une API sécurisée via `contextBridge` dans `preload.js` (`window.electron.updater`) et typage strict dans `types/electron.d.ts` (`IElectronUpdaterBridge`).

4. **Interface Utilisateur de Gestion des Mises à Jour (`UpdateManager`)** :
   - Création du composant `UpdateManager.tsx` et intégration dans l'onglet "Mises à jour" des Paramètres Desktop.
   - Affichage de la version installée, du chemin de la base locale, de l'état de mise à jour en temps réel et des boutons d'action ("Vérifier maintenant", "Télécharger", "Redémarrer et Installer").

## Alternatives Considered

- Alternative 1 : Utiliser `output: 'export'` (statique) pour Next.js — Rejeté car inapplicable : un export purement statique supprime tous les Route Handlers et Server Actions, rendant impossible l'exécution locale de `better-sqlite3` et des requêtes comptables chiffrées.
- Alternative 2 : Téléchargement automatique silencieux forcé (`autoDownload: true`) — Rejeté car risquerait de saturer la bande passante des agences commerciales lors des heures de pointe de facturation.

## Risks

- Risk: Mise à jour appliquée pendant qu'une facture est en cours d'édition locale.
- Mitigation: Le redémarrage pour installation n'est jamais automatique pendant l'utilisation ; l'utilisateur doit cliquer explicitement sur "Redémarrer et Installer" ou quitter l'application à la fermeture de sa session.

## Verification

- Command: `npm run quality:decisions`
- Test: `npx vitest run tests/unit/phase3-packaging-autoupdater.test.ts`
- Manual check: Vérification de l'onglet "Mises à jour" dans les paramètres Desktop et des handlers IPC dans `preload.js`.
