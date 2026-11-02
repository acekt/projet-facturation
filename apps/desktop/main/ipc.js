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
function registerAllIpcHandlers({ userDataPath, getMainWindow, logToFile, onAppReady }) {
  const { app, ipcMain, BrowserWindow, dialog } = require('electron');

  // ── Notification de disponibilité complète de l'UI React (transition splash fluide)
  ipcMain.handle('app:report-ready', (event) => {
    if (!validateSender(event?.senderFrame)) {
      throw new Error('[IPC:app:report-ready] Expéditeur non autorisé.');
    }
    if (typeof onAppReady === 'function') {
      onAppReady();
    }
    return { success: true };
  });

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
      let printWin = null;
      let tempPath = null;
      try {
        printWin = new BrowserWindow({
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        });

        tempPath = path.join(userDataPath, `print_temp_${Date.now()}.html`);

        await fs.promises.writeFile(tempPath, htmlContent, 'utf8');

        let isSettled = false;

        const cleanup = async () => {
          if (printWin && !printWin.isDestroyed()) {
            printWin.webContents.removeAllListeners('did-finish-load');
            printWin.webContents.removeAllListeners('did-fail-load');
            printWin.destroy();
            printWin = null;
          }
          if (tempPath && fs.existsSync(tempPath)) {
            try {
              await fs.promises.unlink(tempPath);
            } catch (e) {
              logToFile('WARN', `[Print] Impossible de supprimer le fichier temp: ${e.message}`);
            }
          }
        };

        const timer = setTimeout(async () => {
          if (!isSettled) {
            isSettled = true;
            logToFile('ERROR', `[Print] Timeout de 15s atteint lors du chargement HTML.`);
            await cleanup();
            reject(new Error('Timeout lors de la préparation du document pour impression.'));
          }
        }, 15000);

        printWin.webContents.on('did-finish-load', () => {
          if (isSettled) return;
          // Déarmement immédiat du timer de préparation : l'utilisateur dispose de tout le temps
          // nécessaire pour interagir avec la boîte de dialogue native du système d'exploitation.
          clearTimeout(timer);
          logToFile('INFO', '[Print] Fenêtre cachée chargée, ouverture de la boîte d\'impression native');

          printWin.webContents.print(
            {
              silent: false,
              printBackground: true,
            },
            async (success, errorType) => {
              if (isSettled) return;
              isSettled = true;

              await cleanup();

              if (success) {
                logToFile('INFO', '[Print] Impression validée avec succès par l\'utilisateur');
                resolve({ success: true });
              } else if (!errorType || /cancel/i.test(errorType) || errorType === 'cancelled' || errorType === 'user-cancelled') {
                logToFile('INFO', `[Print] Impression annulée par l'utilisateur (${errorType || 'dialog_closed'})`);
                resolve({ success: false, cancelled: true });
              } else {
                logToFile('WARN', `[Print] Échec de l'impression native: ${errorType}`);
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
          await cleanup();
          reject(new Error('Échec du rendu du document.'));
        });

        printWin.loadFile(tempPath).catch((err) => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timer);
            cleanup().then(() => reject(err));
          }
        });

      } catch (err) {
        logToFile('ERROR', `[Print] Erreur de préparation du document: ${err.message}`);
        if (printWin && !printWin.isDestroyed()) {
           printWin.destroy();
        }
        reject(new Error('Erreur de préparation du document.'));
      }
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

/**
 * Nettoie les fichiers temporaires générés par l'impression et l'export PDF
 * qui auraient pu subsister suite à un arrêt brutal de l'application.
 * @param {string} userDataPath
 * @param {Function} logToFile
 */
async function cleanupTempFiles(userDataPath, logToFile) {
  try {
    const files = await fs.promises.readdir(userDataPath);
    const tempFiles = files.filter(f => f.startsWith('print_temp_') || f.startsWith('pdf_temp_'));

    if (tempFiles.length > 0) {
      logToFile('INFO', `[Cleanup] ${tempFiles.length} fichiers temporaires résiduels trouvés.`);
      for (const file of tempFiles) {
        try {
          await fs.promises.unlink(path.join(userDataPath, file));
        } catch (e) {
          logToFile('WARN', `[Cleanup] Impossible de supprimer ${file}: ${e.message}`);
        }
      }
      logToFile('INFO', '[Cleanup] Nettoyage des fichiers temporaires terminé.');
    }
  } catch (err) {
    logToFile('WARN', `[Cleanup] Erreur lors de la lecture de ${userDataPath}: ${err.message}`);
  }
}

module.exports = {
  validateSender,
  registerAllIpcHandlers,
  cleanupTempFiles,
};
