/**
 * main.js — Processus Principal Electron "Facturier" (Modularisé Lot J / P5)
 * =========================================================================
 * Découpé en modules spécialisés sous main/ :
 *  - main/logging.js : Journal persistant userData/main.log et console
 *  - main/secrets.js : Gestion robuste des secrets cryptographiques
 *  - main/backup.js  : Sauvegarde journalière vérifiée de la base SQLite
 *  - main/server.js  : Cycle de vie du serveur Next.js standalone (anti-zombie)
 *  - main/window.js  : Splash screen, BrowserWindow et confinement strict
 *  - main/ipc.js     : Handlers IPC avec validation d'expéditeur (validateSender)
 *  - main/updater.js : Mises à jour automatiques via electron-updater
 */

'use strict';

const { app, Menu, BrowserWindow, dialog } = require('electron');
Menu.setApplicationMenu(null);

app.setName('Facturier');
process.setMaxListeners(20);

const USER_DATA_PATH = app.getPath('userData');
const isDev = !app.isPackaged;

if (isDev) {
  // Neutralise le bruit Crashpad 0x2 sous Windows lorsqu'aucun pipe de télémétrie n'est configuré
  app.commandLine.appendSwitch('disable-crash-reporter');
}
// Prévient les plantages OOM (Out of Memory) du processus renderer Chromium
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');

const { initLogger, logToFile } = require('./main/logging');
const { loadOrGenerateSecrets } = require('./main/secrets');
const { performDailyBackup } = require('./main/backup');
const {
  findAvailablePort,
  scanForDevServer,
  resolveStandaloneServer,
  waitForServer,
  killNextProcess,
  startNextServer,
} = require('./main/server');
const {
  createSplashWindow,
  createMainWindow,
  getMainWindow,
  notifyAppReady,
} = require('./main/window');
const { validateSender, registerAllIpcHandlers, cleanupTempFiles } = require('./main/ipc');
const { setupAutoUpdater, registerUpdaterIpc } = require('./main/updater');

initLogger(USER_DATA_PATH);

const STANDALONE_SERVER = resolveStandaloneServer(process.resourcesPath, __dirname);

logToFile(
  'INFO',
  `Démarrage — mode: ${isDev ? 'DÉVELOPPEMENT' : 'PRODUCTION'} | server: ${STANDALONE_SERVER} | userData: ${USER_DATA_PATH}`
);

let isServerReady = false;

// ── Enregistrement des IPC Handlers
registerAllIpcHandlers({
  userDataPath: USER_DATA_PATH,
  getMainWindow,
  logToFile,
  onAppReady: notifyAppReady,
});

registerUpdaterIpc({
  validateSender,
  isDev,
  logToFile,
});

// ── Cycle de vie de l'application
app.whenReady().then(async () => {
  cleanupTempFiles(USER_DATA_PATH, logToFile);
  performDailyBackup(USER_DATA_PATH, logToFile);
  let port;

  if (isDev) {
    createSplashWindow({
      resourcesPath: process.resourcesPath,
      baseDir: __dirname,
      logToFile,
    });
    logToFile('INFO', '[Dev] Recherche du serveur Next.js en cours...');

    let foundPort = null;
    let attempts = 0;

    while (!foundPort && attempts < 60) {
      foundPort = await scanForDevServer();
      if (!foundPort) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        attempts++;
      }
    }

    if (foundPort) {
      port = foundPort;
      logToFile('INFO', `[Dev] Serveur Next.js détecté avec succès sur le port ${port} !`);
      try {
        await waitForServer(`http://127.0.0.1:${port}`, 60000, logToFile);
        isServerReady = true;
      } catch (e) {
        logToFile('WARN', `[Dev] Health check timeout: ${e.message} — tentative de chargement quand même.`);
      }
    } else {
      logToFile('ERROR', '[Dev] Impossible de trouver Next.js. Avez-vous lancé npm run dev ?');
      dialog.showErrorBox(
        'Serveur Introuvable',
        "Aucun serveur Next.js n'a été détecté. Veuillez lancer 'npm run dev' dans un terminal."
      );
      app.quit();
      return;
    }
  } else {
    const appSecrets = loadOrGenerateSecrets(USER_DATA_PATH, logToFile);
    port = await findAvailablePort(3000);
    await startNextServer({
      port,
      userDataPath: USER_DATA_PATH,
      standaloneServer: STANDALONE_SERVER,
      appSecrets,
      logToFile,
    });
    isServerReady = true;
  }

  createMainWindow({
    port,
    isDev,
    isServerReady,
    resourcesPath: process.resourcesPath,
    baseDir: __dirname,
    userDataPath: USER_DATA_PATH,
    logToFile,
    waitForServerFn: (url, timeout, logger) => waitForServer(url, timeout, logger),
    scanForDevServerFn: () => scanForDevServer(),
  });

  setupAutoUpdater({
    getMainWindow,
    isDev,
    logToFile,
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow({
        port,
        isDev,
        isServerReady,
        resourcesPath: process.resourcesPath,
        baseDir: __dirname,
        userDataPath: USER_DATA_PATH,
        logToFile,
        waitForServerFn: (url, timeout, logger) => waitForServer(url, timeout, logger),
        scanForDevServerFn: () => scanForDevServer(),
      });
    }
  });
});

// ── Gestion de l'extinction et nettoyage anti-zombie Windows
app.on('before-quit', () => {
  killNextProcess(logToFile);
});

app.on('window-all-closed', () => {
  killNextProcess(logToFile);
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('exit', () => {
  killNextProcess(logToFile);
});

process.on('SIGINT', () => {
  killNextProcess(logToFile);
  process.exit(0);
});

process.on('SIGTERM', () => {
  killNextProcess(logToFile);
  process.exit(0);
});
