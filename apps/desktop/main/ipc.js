'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Validation de l'expéditeur IPC (Recommandation Sécurité Electron #17 / Lot F2 / S2).
 * Vérifie que l'invocation provient bien de notre serveur Next.js local (127.0.0.1 ou localhost).
 * @param {Electron.WebFrameMain} frame
 * @returns {boolean}
 */
function validateSender(frame) {
  if (!frame || !frame.origin) return false;
  if (frame.parent && frame.parent !== null) return false;
  try {
    const parsed = new URL(frame.origin);
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

/**
 * Enregistre l'ensemble des handlers IPC de l'application.
 * @param {object} options
 * @param {string} options.userDataPath
 * @param {Function} options.getMainWindow
 * @param {Function} options.logToFile
 */
function registerAllIpcHandlers({ userDataPath, getMainWindow, logToFile }) {
  const { app, ipcMain, BrowserWindow, dialog } = require('electron');
  // ── Version de l'application
  ipcMain.handle('app:get-version', (event) => {
    if (!validateSender(event?.senderFrame)) {
      throw new Error('[IPC:app:get-version] Expéditeur non autorisé.');
    }
    return app.getVersion();
  });

  // ── Dossier userData
  ipcMain.handle('app:get-userData-path', (event) => {
    if (!validateSender(event?.senderFrame)) {
      throw new Error('[IPC:app:get-userData-path] Expéditeur non autorisé.');
    }
    return userDataPath;
  });

  // ── Impression native (fenêtre active)
  ipcMain.handle('print-to-pdf', async (event) => {
    if (!validateSender(event?.senderFrame)) {
      throw new Error('[IPC:print-to-pdf] Expéditeur non autorisé.');
    }
    const win = BrowserWindow.getFocusedWindow() || getMainWindow();
    if (!win) {
      throw new Error('[IPC:print-to-pdf] Aucune fenêtre disponible pour l\'impression.');
    }
    return new Promise((resolve, reject) => {
      win.webContents.print({ silent: false, printBackground: true }, (success, errorType) => {
        if (success) {
          resolve({ success: true });
        } else {
          reject(new Error(`[IPC:print-to-pdf] Échec: ${errorType}`));
        }
      });
    });
  });

  // ── Moteur d'impression formelle A4 (Fenêtre cachée)
  ipcMain.handle('print-document', async (event, htmlContent) => {
    if (!validateSender(event?.senderFrame)) {
      throw new Error('[IPC:print-document] Expéditeur non autorisé.');
    }
    return new Promise(async (resolve, reject) => {
      let printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });

      const tempPath = path.join(userDataPath, `print_temp_${Date.now()}.html`);

      try {
        await fs.promises.writeFile(tempPath, htmlContent, 'utf8');
      } catch (err) {
        logToFile('ERROR', `[Print] Impossible d'écrire le fichier temp: ${err.message}`);
        printWin.destroy();
        return reject(new Error('Erreur de préparation du document.'));
      }

      let isSettled = false;
      const timer = setTimeout(async () => {
        if (!isSettled) {
          isSettled = true;
          logToFile('ERROR', `[Print] Timeout de 15s atteint lors de la génération.`);
          if (printWin && !printWin.isDestroyed()) {
            printWin.webContents.removeAllListeners('did-finish-load');
            printWin.webContents.removeAllListeners('did-fail-load');
            printWin.destroy();
            printWin = null;
          }
          try {
            if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath);
          } catch (_) {}
          reject(new Error('Timeout lors de la préparation du document.'));
        }
      }, 15000);

      printWin.webContents.on('did-finish-load', () => {
        if (isSettled) return;
        logToFile('INFO', '[Print] Fenêtre cachée chargée, lancement de print()');

        printWin.webContents.print(
          {
            silent: false,
            printBackground: true,
          },
          async (success, errorType) => {
            if (isSettled) return;
            isSettled = true;
            clearTimeout(timer);

            if (printWin && !printWin.isDestroyed()) {
              printWin.destroy();
            }
            printWin = null;

            try {
              if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath);
            } catch (e) {
              logToFile('WARN', `[Print] Impossible de supprimer le fichier temp: ${e.message}`);
            }

            if (success) {
              resolve({ success: true });
            } else {
              logToFile('WARN', `[Print] Impression annulée ou échouée: ${errorType}`);
              reject(new Error(errorType));
            }
          }
        );
      });

      printWin.webContents.on('did-fail-load', async (ev, errorCode, errorDescription) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timer);

        logToFile('ERROR', `[Print] Échec du chargement de la page d'impression: ${errorDescription}`);
        if (printWin && !printWin.isDestroyed()) {
          printWin.destroy();
        }
        printWin = null;
        try {
          if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath);
        } catch (_) {}
        reject(new Error('Échec du rendu du document.'));
      });

      printWin.loadFile(tempPath).catch(() => {});
    });
  });

  // ── Export PDF natif
  ipcMain.handle('export-pdf', async (event, htmlContent, defaultFilename = 'document.pdf') => {
    if (!validateSender(event?.senderFrame)) {
      throw new Error('[IPC:export-pdf] Expéditeur non autorisé.');
    }
    const tempPath = path.join(userDataPath, `pdf_temp_${Date.now()}.html`);
    let pdfWin = null;

    try {
      await fs.promises.writeFile(tempPath, htmlContent, 'utf8');
      logToFile('INFO', `[PDF] Fichier HTML temp écrit : ${tempPath}`);

      pdfWin = new BrowserWindow({
        show: false,
        width: 794,
        height: 1123,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });

      const loadPromise = pdfWin.loadFile(tempPath);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout lors du chargement de la page pour le PDF.')), 15000);
      });

      await Promise.race([loadPromise, timeoutPromise]);
      logToFile('INFO', '[PDF] Fenêtre cachée chargée, démarrage de printToPDF...');

      const printPromise = pdfWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        marginsType: 1,
        landscape: false,
      });

      const printTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout lors de la génération du PDF.')), 15000);
      });

      const pdfBuffer = await Promise.race([printPromise, printTimeoutPromise]);
      logToFile('INFO', `[PDF] Buffer généré (${pdfBuffer.length} octets)`);

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Enregistrer le document PDF',
        defaultPath: path.join(app.getPath('documents'), defaultFilename),
        filters: [{ name: 'Fichier PDF', extensions: ['pdf'] }],
      });

      if (canceled || !filePath) {
        logToFile('INFO', '[PDF] Sauvegarde annulée par l\'utilisateur.');
        return { saved: false };
      }

      await fs.promises.writeFile(filePath, pdfBuffer);
      logToFile('INFO', `[PDF] Fichier sauvegardé : ${filePath}`);

      return { saved: true, filePath };
    } catch (err) {
      logToFile('ERROR', `[PDF] Erreur lors de la génération : ${err.message}`);
      throw err;
    } finally {
      if (pdfWin && !pdfWin.isDestroyed()) {
        pdfWin.destroy();
        pdfWin = null;
      }
      try {
        if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath);
        logToFile('INFO', `[PDF] Fichier temp nettoyé : ${tempPath}`);
      } catch (cleanErr) {
        logToFile('WARN', `[PDF] Impossible de nettoyer le temp : ${cleanErr.message}`);
      }
    }
  });
}

module.exports = {
  validateSender,
  registerAllIpcHandlers,
};
