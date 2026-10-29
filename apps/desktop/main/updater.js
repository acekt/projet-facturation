'use strict';

const { autoUpdater } = require('electron-updater');
const { app, dialog, ipcMain } = require('electron');

let updateDownloaded = false;

/**
 * Configure et initialise l'auto-updater Electron.
 * @param {object} options
 * @param {Function} options.getMainWindow
 * @param {boolean} options.isDev
 * @param {Function} options.logToFile
 */
function setupAutoUpdater({ getMainWindow, isDev, logToFile }) {
  if (isDev) return;

  autoUpdater.logger = {
    info: (msg) => logToFile('INFO', `[AutoUpdater] ${msg}`),
    warn: (msg) => logToFile('WARN', `[AutoUpdater] ${msg}`),
    error: (msg) => logToFile('ERROR', `[AutoUpdater] ${msg}`),
  };

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    logToFile('INFO', '[AutoUpdater] Recherche de mises à jour en cours...');
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', { status: 'checking' });
    }
  });

  autoUpdater.on('update-available', (info) => {
    logToFile('INFO', `[AutoUpdater] Mise à jour disponible : v${info.version}`);
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', {
        status: 'available',
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });
    }
    dialog.showMessageBox({
      type: 'info',
      title: 'Mise à jour disponible',
      message: `La version ${info.version} de Facturier est disponible. Le téléchargement va commencer en arrière-plan.`,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    logToFile('INFO', '[AutoUpdater] Application à jour.');
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', {
        status: 'not-available',
        version: info?.version || app.getVersion(),
      });
    }
  });

  autoUpdater.on('error', (err) => {
    logToFile('WARN', `[AutoUpdater] Statut vérification : ${err?.message || err}`);
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', {
        status: 'error',
        error: err?.message || 'Erreur lors de la vérification des mises à jour',
      });
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    logToFile('INFO', `[AutoUpdater] Progression : ${Math.round(progressObj.percent)}%`);
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:progress', {
        percent: progressObj.percent,
        bytesPerSecond: progressObj.bytesPerSecond,
        total: progressObj.total,
        transferred: progressObj.transferred,
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true;
    logToFile('INFO', `[AutoUpdater] Mise à jour v${info.version} téléchargée avec succès.`);
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', {
        status: 'downloaded',
        version: info.version,
      });
    }
    dialog.showMessageBox({
      type: 'question',
      buttons: ['Installer et Redémarrer', 'Plus tard'],
      defaultId: 0,
      title: 'Mise à jour prête',
      message: 'La nouvelle version a été téléchargée. Voulez-vous l\'installer maintenant ?',
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.checkForUpdatesAndNotify();
}

/**
 * Enregistre les handlers IPC pour le dialogue d'auto-update.
 * @param {object} options
 * @param {Function} options.validateSender
 * @param {boolean} options.isDev
 * @param {Function} options.logToFile
 */
function registerUpdaterIpc({ validateSender, isDev, logToFile }) {
  ipcMain.handle('updater:check', async (event) => {
    if (!validateSender(event?.senderFrame)) {
      throw new Error('[IPC:updater:check] Expéditeur non autorisé.');
    }
    if (isDev) {
      logToFile('INFO', '[AutoUpdater] Recherche ignorée en mode développement.');
      return { success: true, isDev: true, message: 'Mode développement : mises à jour désactivées.' };
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      return {
        success: true,
        updateAvailable: Boolean(result?.updateInfo?.version && result.updateInfo.version !== app.getVersion()),
        info: result?.updateInfo,
      };
    } catch (err) {
      logToFile('ERROR', `[AutoUpdater] Échec checkForUpdates: ${err.message}`);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('updater:download', async (event) => {
    if (!validateSender(event?.senderFrame)) {
      throw new Error('[IPC:updater:download] Expéditeur non autorisé.');
    }
    if (isDev) return { success: false, error: 'Non disponible en mode développement' };
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('updater:install', async (event) => {
    if (!validateSender(event?.senderFrame)) {
      throw new Error('[IPC:updater:install] Expéditeur non autorisé.');
    }
    if (isDev) return { success: false, error: 'Non disponible en mode développement' };
    try {
      autoUpdater.quitAndInstall(false, true);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = {
  setupAutoUpdater,
  registerUpdaterIpc,
};
