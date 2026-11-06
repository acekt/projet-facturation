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
  const { app, ipcMain, BrowserWindow, dialog, shell, clipboard } = require('electron');

  async function ensureSharedDocsDir() {
    let baseDir = userDataPath;
    try {
      baseDir = app.getPath('documents');
    } catch {
      baseDir = userDataPath;
    }
    const sharedDir = path.join(baseDir, 'Facturier', 'Partages');
    await fs.promises.mkdir(sharedDir, { recursive: true });
    return sharedDir;
  }

  function sanitizePdfFilename(filename = 'document.pdf') {
    const clean = String(filename || 'document.pdf')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .trim();
    return clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`;
  }

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

  // ── Ouverture sécurisée des liens externes (WhatsApp, mailto)
  ipcMain.handle('app:open-external', async (event, url) => {
    if (!validateSender(event?.senderFrame)) {
      throw new Error('[IPC:app:open-external] Expéditeur non autorisé.');
    }
    if (typeof url !== 'string') {
      throw new Error('[IPC:app:open-external] URL invalide.');
    }
    // filter externally
    if (!url.startsWith('https://') && !url.startsWith('mailto:') && !url.startsWith('whatsapp:')) {
       throw new Error('[IPC:app:open-external] Protocole non autorisé.');
    }

    const isAllowed = /^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(url) || /^mailto:/.test(url);
    if (!isAllowed) {
      if (typeof logToFile === 'function') {
        logToFile('WARN', `[IPC:app:open-external] URL externe rejetée : ${url}`);
      }
      throw new Error('[IPC:app:open-external] Protocole ou domaine non autorisé.');
    }

    if (typeof logToFile === 'function') {
      logToFile('INFO', `[IPC:app:open-external] Ouverture externe autorisée : ${url}`);
    }
    await shell.openExternal(url);
    return { success: true };
  });

  // ── Révéler un fichier dans l'explorateur OS
  ipcMain.handle('app:show-item-in-folder', async (event, fullPath) => {
    if (!validateSender(event?.senderFrame)) {
      throw new Error('[IPC:app:show-item-in-folder] Expéditeur non autorisé.');
    }
    if (typeof fullPath !== 'string') {
      throw new Error('[IPC:app:show-item-in-folder] Chemin invalide.');
    }
    shell.showItemInFolder(fullPath);
    return { success: true };
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

  // ── Génération PDF A4 en mémoire (Base64 + sauvegarde locale automatique sans boîte de dialogue bloquante)
  ipcMain.handle('app:render-pdf-buffer', async (event, htmlContent, defaultFilename = 'document.pdf') => {
    if (!validateSender(event?.senderFrame)) {
      throw new Error('[IPC:app:render-pdf-buffer] Expéditeur non autorisé.');
    }
    const tempPath = path.join(
      userDataPath,
      `pdf_buffer_temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.html`
    );
    let pdfWin = null;

    try {
      await fs.promises.writeFile(tempPath, htmlContent, 'utf8');

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
        setTimeout(() => reject(new Error('Timeout lors du chargement HTML pour le PDF.')), 15000);
      });

      await Promise.race([loadPromise, timeoutPromise]);

      const printPromise = pdfWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        marginsType: 1,
        landscape: false,
      });
      const printTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout lors de la génération du buffer PDF.')), 15000);
      });

      const pdfBuffer = await Promise.race([printPromise, printTimeoutPromise]);
      const sharedDir = await ensureSharedDocsDir();
      const safeName = sanitizePdfFilename(defaultFilename);
      const savedFilePath = path.join(sharedDir, safeName);
      await fs.promises.writeFile(savedFilePath, pdfBuffer);

      if (typeof logToFile === 'function') {
        logToFile('INFO', `[PDF:Buffer] PDF généré en mémoire (${pdfBuffer.length} octets) et sauvegardé : ${savedFilePath}`);
      }

      return {
        success: true,
        pdfBase64: Buffer.from(pdfBuffer).toString('base64'),
        filePath: savedFilePath,
      };
    } catch (err) {
      if (typeof logToFile === 'function') {
        logToFile('ERROR', `[PDF:Buffer] Erreur lors de la génération : ${err.message}`);
      }
      throw err;
    } finally {
      if (pdfWin && !pdfWin.isDestroyed()) {
        pdfWin.destroy();
        pdfWin = null;
      }
      try {
        if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath);
      } catch (cleanErr) {
        if (typeof logToFile === 'function') {
          logToFile('WARN', `[PDF:Buffer] Impossible de nettoyer le temp : ${cleanErr.message}`);
        }
      }
    }
  });

  // ── Sauvegarde rapide d'un PDF Base64 + copie presse-papiers + révélation dans l'explorateur OS
  ipcMain.handle('app:save-and-reveal-pdf', async (event, payload = {}) => {
    if (!validateSender(event?.senderFrame)) {
      throw new Error('[IPC:app:save-and-reveal-pdf] Expéditeur non autorisé.');
    }
    const { pdfBase64, pdfFilename = 'document.pdf', textToCopy } = payload || {};
    if (typeof textToCopy === 'string' && textToCopy.trim().length > 0) {
      clipboard.writeText(textToCopy);
    }
    let savedFilePath;
    if (typeof pdfBase64 === 'string' && pdfBase64.length > 0) {
      const sharedDir = await ensureSharedDocsDir();
      const safeName = sanitizePdfFilename(pdfFilename);
      savedFilePath = path.join(sharedDir, safeName);
      await fs.promises.writeFile(savedFilePath, Buffer.from(pdfBase64, 'base64'));
      shell.showItemInFolder(savedFilePath);
    }
    return {
      success: true,
      filePath: savedFilePath,
    };
  });

  // ── Fenêtre WhatsApp Web intégrée dans Electron (partition persistante + presse-papiers + PDF prêt à glisser-déposer)
  ipcMain.handle('app:open-whatsapp-in-app', async (event, payload = {}) => {
    if (!validateSender(event?.senderFrame)) {
      throw new Error('[IPC:app:open-whatsapp-in-app] Expéditeur non autorisé.');
    }

    const { phone, message = '', pdfBase64, pdfFilename = 'document.pdf' } = payload || {};
    const cleanPhone = String(phone || '').replace(/[^\d]/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      throw new Error('Veuillez saisir un numéro de téléphone WhatsApp valide.');
    }

    if (typeof message === 'string' && message.trim().length > 0) {
      clipboard.writeText(message);
    }

    let savedFilePath;
    if (typeof pdfBase64 === 'string' && pdfBase64.length > 0) {
      const sharedDir = await ensureSharedDocsDir();
      const safeName = sanitizePdfFilename(pdfFilename);
      savedFilePath = path.join(sharedDir, safeName);
      await fs.promises.writeFile(savedFilePath, Buffer.from(pdfBase64, 'base64'));
    }

    const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : null;
    const waWin = new BrowserWindow({
      width: 1100,
      height: 780,
      parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
      title: 'Facturier — Messagerie WhatsApp Intégrée',
      autoHideMenuBar: true,
      webPreferences: {
        partition: 'persist:facturier-whatsapp',
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    const modernChromeUA =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    waWin.webContents.setUserAgent(modernChromeUA);

    const waUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message || '')}`;
    waWin.loadURL(waUrl, { userAgent: modernChromeUA }).catch((err) => {
      if (typeof logToFile === 'function') {
        logToFile('WARN', `[WhatsApp:InApp] Avertissement chargement URL : ${err.message}`);
      }
    });

    if (savedFilePath) {
      shell.showItemInFolder(savedFilePath);
    }

    if (typeof logToFile === 'function') {
      logToFile('INFO', `[WhatsApp:InApp] Fenêtre interne ouverte pour +${cleanPhone} (PDF: ${savedFilePath || 'aucun'})`);
    }

    return {
      success: true,
      filePath: savedFilePath,
    };
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
    const tempFiles = files.filter(
      (f) => f.startsWith('print_temp_') || f.startsWith('pdf_temp_') || f.startsWith('pdf_buffer_temp_')
    );

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
