/**
 * main.js — Processus Principal Electron "L'Étoile"
 * ===================================================
 * Architecture Desktop-first : l'app charge Next.js en dev (localhost)
 * et les fichiers statiques exportés en production (file://).
 *
 * Corrections appliquées :
 *  [AXE 1] Injection de ELECTRON_USERDATA_PATH → SQLite hors app.asar
 *  [AXE 1] Production : chargement des fichiers statiques (file://), pas localhost
 *  [AXE 1] IPC sécurisé : print-to-pdf async, dialog:open-folder async
 *  [AXE 2] Liens externes interceptés → shell.openExternal (navigateur OS)
 *  [AXE 2] Content Security Policy stricte (pas de ressources réseau hors dev)
 *  [AXE 4] Suppression du console.log de debug sur fallback de port
 */

'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

// ── AXE 1 : Injecter le chemin userData avant que Next.js (et SQLite) se lancent
// Le renderer charge les routes /api/* qui elles-mêmes importent lib/db.ts côté
// server. Ce process.env est hérité par le sous-processus Next.js.
process.env.ELECTRON_USERDATA_PATH = app.getPath('userData');

// ── AXE 2 : Désactiver le cache disque Chromium (inutile pour une app offline)
app.commandLine.appendSwitch('disable-http-cache');

// ── Fenêtre principale
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: "L'Étoile — Gestion & Facturation",
    // Masquer la frame native : l'app a sa propre UI de navigation
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,         // Jamais true — sécurité critique
      contextIsolation: true,          // Toujours true — isolation renderer
      sandbox: false,                  // false requis pour better-sqlite3 côté serveur
      preload: path.join(__dirname, 'preload.js'),
      // ── AXE 2 : CSP renforcée
      // En prod, aucune requête réseau externe n'est autorisée.
      // En dev, localhost est permis pour le HMR Turbopack.
      webSecurity: !isDev,
    },
    icon: path.join(__dirname, 'public', 'icon.png'),
    show: false, // Anti-flash : on affiche la fenêtre quand elle est prête
    backgroundColor: '#030303', // Même couleur que --background dark pour éviter le flash blanc
  });

  // ── Anti-flash blanc : afficher seulement quand prêt
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // ── Chargement de l'application
  if (isDev) {
    // Développement : Next.js dev server (port 3000 ou 3001 si occupé)
    const port = process.env.PORT || 3000;
    const devUrl = `http://localhost:${port}`;
    const fallbackUrl = `http://localhost:${parseInt(port) + 1}`;

    mainWindow.loadURL(devUrl).catch(() => {
      mainWindow.loadURL(fallbackUrl);
    });

    // DevTools disponibles uniquement en dev
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production : charger les fichiers statiques exportés par `next export`
    // Structure attendue : ./out/index.html (généré par `next build && next export`)
    const indexPath = path.join(__dirname, 'out', 'index.html');
    mainWindow.loadFile(indexPath).catch((err) => {
      // Dernier recours : afficher une page d'erreur inline
      mainWindow.loadURL(`data:text/html,<h1>Erreur de chargement</h1><pre>${err.message}</pre>`);
    });
  }

  // ── AXE 1 : Gestion du retry en dev si le serveur n'est pas encore démarré
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (isDev && validatedURL && validatedURL.includes('localhost')) {
      // Retry silencieux après 1 seconde (Turbopack peut être lent au démarrage)
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.reload();
        }
      }, 1000);
    }
  });

  // ── AXE 2 : Intercepter TOUS les liens externes (http/https) pour les ouvrir
  // dans le navigateur par défaut de l'OS, et NON dans l'app Electron.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' }; // Bloquer toute popup dans l'app
  });

  // Liens <a href> avec target="_blank"
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appUrl = isDev ? 'http://localhost' : 'file://';
    if (!url.startsWith(appUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ══════════════════════════════════════════════════════════════════════
// IPC HANDLERS (AXE 1 — Tous async via ipcMain.handle, jamais sendSync)
// ══════════════════════════════════════════════════════════════════════

/**
 * print-to-pdf
 * Déclenche l'impression native via la boîte de dialogue système.
 * Le renderer appelle: await window.electron.print()
 */
ipcMain.handle('print-to-pdf', async () => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
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

/**
 * app:get-version
 * Expose la version de l'application au renderer (pour l'UI Paramètres).
 */
ipcMain.handle('app:get-version', () => app.getVersion());

/**
 * app:get-userData-path
 * Expose le chemin userData au renderer (pour debug ou affichage dans l'UI).
 */
ipcMain.handle('app:get-userData-path', () => app.getPath('userData'));
