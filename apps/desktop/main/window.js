'use strict';

const path = require('path');
const fs = require('fs');
const { BrowserWindow, nativeImage, app, nativeTheme } = require('electron');

let mainWindow = null;
let splashWindow = null;

/**
 * Résout le chemin ou le NativeImage de l'icône de l'application de façon robuste.
 * @param {string} resourcesPath
 * @param {string} baseDir
 * @param {Function} logToFile
 * @returns {import('electron').NativeImage | string | undefined}
 */
function resolveAppIcon(resourcesPath, baseDir, logToFile) {
  const unpackedIco = path.join(resourcesPath || '', 'app.asar.unpacked', 'build', 'icon.ico');
  if (fs.existsSync(unpackedIco)) {
    return unpackedIco;
  }

  const candidates = [
    path.join(baseDir, 'build', 'icon.ico'),
    path.join(baseDir, 'build', 'icon.png'),
    path.join(baseDir, 'public', 'icon.png'),
    path.join(baseDir, 'public', 'logo.png'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        const img = nativeImage.createFromPath(c);
        if (!img.isEmpty()) {
          return img;
        }
      } catch (err) {
        logToFile('WARN', `[Icon] Erreur lors de la lecture de ${c} : ${err.message}`);
      }
    }
  }

  return undefined;
}

/**
 * Résout le chemin du fichier splash.html.
 * @param {string} resourcesPath
 * @param {string} baseDir
 * @returns {string}
 */
function resolveSplashPath(resourcesPath, baseDir) {
  const candidates = [
    path.join(baseDir, 'public', 'splash.html'),
    path.join(baseDir, 'splash.html'),
    path.join(resourcesPath || '', 'standalone', 'public', 'splash.html'),
    path.join(resourcesPath || '', 'public', 'splash.html'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return candidates[0];
}

/**
 * Affiche la fenêtre de démarrage (Splash Screen).
 * @param {object} options
 * @param {string} options.resourcesPath
 * @param {string} options.baseDir
 * @param {Function} options.logToFile
 */
function createSplashWindow({ resourcesPath, baseDir, logToFile }) {
  if (splashWindow && !splashWindow.isDestroyed()) return;

  const appIcon = resolveAppIcon(resourcesPath, baseDir, logToFile);
  const isDark = nativeTheme && nativeTheme.shouldUseDarkColors;
  const splashOpts = {
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: false,
    resizable: false,
    show: false,
    backgroundColor: isDark ? '#09090b' : '#fafafa',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  };
  if (appIcon) {
    splashOpts.icon = appIcon;
  }

  splashWindow = new BrowserWindow(splashOpts);
  const splashPath = resolveSplashPath(resourcesPath, baseDir);
  const exists = fs.existsSync(splashPath);
  logToFile('INFO', `[Splash] Chargement du splash screen : ${splashPath} (existe: ${exists})`);

  splashWindow.loadFile(splashPath).catch((err) => {
    logToFile('ERROR', `[Splash] Échec de loadFile(${splashPath}) : ${err.message}`);
  });

  splashWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show();
    }
  });
}

function closeSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy();
    splashWindow = null;
  }
}

/**
 * Crée la fenêtre principale avec confinement d'URL strict et fallback UI.
 * @param {object} options
 * @param {number} options.port
 * @param {boolean} options.isDev
 * @param {boolean} options.isServerReady
 * @param {string} options.resourcesPath
 * @param {string} options.baseDir
 * @param {string} options.userDataPath
 * @param {Function} options.logToFile
 * @param {Function} options.waitForServerFn
 * @param {Function} options.scanForDevServerFn
 * @returns {BrowserWindow}
 */
function createMainWindow({
  port,
  isDev,
  isServerReady,
  resourcesPath,
  baseDir,
  userDataPath,
  logToFile,
  waitForServerFn,
  scanForDevServerFn,
}) {
  const appIcon = resolveAppIcon(resourcesPath, baseDir, logToFile);
  const isDark = nativeTheme && nativeTheme.shouldUseDarkColors;
  const winOpts = {
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Facturier — Gestion & Facturation',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(baseDir, 'preload.js'),
      webSecurity: !isDev,
    },
    show: false,
    backgroundColor: isDark ? '#09090b' : '#fafafa',
  };
  if (appIcon) {
    winOpts.icon = appIcon;
  }

  mainWindow = new BrowserWindow(winOpts);
  const appUrl = `http://127.0.0.1:${port}`;
  const logPath = path.join(userDataPath, 'main.log');

  const loadApp = (attempt = 1) => {
    mainWindow.loadURL(appUrl).catch((err) => {
      if (attempt < 3 && !mainWindow.isDestroyed()) {
        logToFile('WARN', `[UI] Tentative loadURL ${attempt}/3 échouée (${err.message}). Nouvelle tentative dans 2.5s...`);
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            loadApp(attempt + 1);
          }
        }, 2500);
        return;
      }
      logToFile('ERROR', `[UI] Échec de mainWindow.loadURL: ${err.message}`);
      const errorHtml = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Démarrage en cours...</title></head>
<body style="background:#fafafa;color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;gap:16px;">
  <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="#003399" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
  </svg>
  <h1 style="margin:0;font-size:1.25rem;color:#0a0a0a;font-weight:700">Initialisation du service Facturier</h1>
  <p style="margin:0;color:#71717a;max-width:480px;text-align:center;line-height:1.6;font-size:0.9rem">
    Le moteur local s'initialise (SQLite, cache...). Veuillez patienter quelques instants.
  </p>
  <p style="margin:0;font-family:monospace;font-size:0.75rem;background:#f4f4f5;padding:8px 16px;border-radius:6px;color:#71717a;max-width:480px;word-break:break-all">
    ${err.message}
  </p>
  <button onclick="window.location.href='${appUrl}'" style="margin-top:8px;padding:10px 24px;background:#003399;border:none;
    border-radius:8px;color:white;cursor:pointer;font-weight:600;font-size:0.9rem;letter-spacing:0.02em;
    transition:background 0.2s" onmouseover="this.style.background='#002277'" onmouseout="this.style.background='#003399'">
    Réessayer
  </button>
  <p style="margin:0;font-size:0.7rem;color:#a1a1aa">Journal de débogage : ${logPath}</p>
</body></html>`;
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
    });
  };

  if (!isServerReady) {
    createSplashWindow({ resourcesPath, baseDir, logToFile });
    logToFile('INFO', `[UI] Attente de /api/health sur le port ${port}...`);
    waitForServerFn(`http://127.0.0.1:${port}`, 25000, logToFile)
      .then(() => {
        logToFile('INFO', '[UI] Serveur prêt — chargement de la fenêtre principale.');
        loadApp();
      })
      .catch((err) => {
        logToFile('WARN', `[UI] Health check timeout: ${err.message} — chargement quand même.`);
        loadApp();
      });
  } else {
    loadApp();
  }

  const showMainWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isVisible()) return;

    mainWindow.show();
    closeSplashWindow();
  };

  mainWindow.once('ready-to-show', () => {
    logToFile('INFO', '[UI] ready-to-show reçu — permutation immédiate du splash vers la fenêtre principale.');
    showMainWindow();
  });

  mainWindow.webContents.once('did-finish-load', () => {
    showMainWindow();
  });

  let retryCount = 0;
  const MAX_RETRIES = 5;
  const crashTimestamps = [];
  const MAX_CRASH_RECOVERIES = 3;
  const CRASH_COOLDOWN_MS = 60000;

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    if (!details || details.reason === 'clean-exit') return;
    logToFile(
      'ERROR',
      `[UI] render-process-gone détecté (reason: ${details.reason}, exitCode: ${details.exitCode})`
    );
    const now = Date.now();
    while (crashTimestamps.length > 0 && now - crashTimestamps[0] > CRASH_COOLDOWN_MS) {
      crashTimestamps.shift();
    }
    if (crashTimestamps.length < MAX_CRASH_RECOVERIES) {
      crashTimestamps.push(now);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          logToFile('INFO', `[UI] Reprise automatique du renderer (${crashTimestamps.length}/${MAX_CRASH_RECOVERIES})...`);
          mainWindow.reload();
        }
      }, 1000);
    } else {
      logToFile('ERROR', `[UI] Seuil de crashs renderer atteint (${MAX_CRASH_RECOVERIES}/60s) — arrêt des rechargements automatiques.`);
    }
  });

  mainWindow.webContents.on('did-fail-load', async (_event, errorCode, _desc, validatedURL) => {
    if (!validatedURL || !validatedURL.includes('127.0.0.1')) return;
    if (retryCount >= MAX_RETRIES) {
      logToFile('ERROR', `[UI] Abandon après ${MAX_RETRIES} tentatives de rechargement.`);
      return;
    }

    retryCount++;
    logToFile('WARN', `[UI] did-fail-load (code: ${errorCode}) — tentative ${retryCount}/${MAX_RETRIES} dans 2s...`);
    await new Promise((r) => setTimeout(r, 2000));
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (isDev && scanForDevServerFn) {
      const foundPort = await scanForDevServerFn();
      if (foundPort && foundPort !== port) {
        mainWindow.loadURL(`http://127.0.0.1:${foundPort}`);
      } else {
        mainWindow.reload();
      }
    } else {
      mainWindow.reload();
    }
  });

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  const LOCAL_ORIGIN = `http://127.0.0.1:${port}`;

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(LOCAL_ORIGIN) || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      mainWindow.loadURL(url);
    } else {
      logToFile('WARN', `[Confinement] Pop-up externe bloquée: ${url}`);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(LOCAL_ORIGIN) || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      return;
    }
    if (url.startsWith('data:')) {
      return;
    }
    event.preventDefault();
    logToFile('WARN', `[Confinement] Navigation externe bloquée: ${url}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function getMainWindow() {
  return mainWindow;
}

module.exports = {
  createSplashWindow,
  closeSplashWindow,
  createMainWindow,
  getMainWindow,
  resolveAppIcon,
};
