/**
 * main.js — Processus Principal Electron "L'Étoile"
 * ===================================================
 *
 * CORRECTIONS PHASE 3-BIS (Stabilité & Conflits de ports) :
 *
 *  [FIX-1] isDev : Basé sur l'absence de .next/standalone/server.js plutôt
 *          que sur NODE_ENV. Quand on lance `electron .` sans `next build`
 *          préalable, NODE_ENV n'est pas 'development' mais le build prod
 *          n'existe pas non plus → crash. On détecte désormais le mode
 *          par la présence du fichier standalone, pas par NODE_ENV.
 *
 *  [FIX-2] findAvailablePort : Boucle jusqu'à MAX_PORT_SCAN ports au lieu
 *          d'un unique fallback à preferred+1. Évite les crashs quand
 *          plusieurs ports sont déjà occupés.
 *
 *  [FIX-3] Dev mode — sondage dynamique du port : En développement,
 *          scanPorts() sonde la plage [3000..3009] pour trouver QUEL port
 *          le serveur `next dev` a choisi, plutôt que d'assumer le 3000.
 *
 *  [FIX-4] Cycle de vie propre : killNextProcess() est appelé sur
 *          'window-all-closed', 'before-quit', ET process.on('exit')
 *          pour empêcher tout processus zombie côté port.
 *
 *  [P0-A]  ELECTRON_USERDATA_PATH passé explicitement dans spawn().env.
 *  [P0-B]  output: 'standalone' → .next/standalone/server.js
 */

'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn }                               = require('child_process');
const path                                    = require('path');
const http                                    = require('http');
const fs                                      = require('fs');

// Prévention de l'avertissement MaxListenersExceeded
process.setMaxListeners(20);

// Verrou global strict de disponibilité du serveur Next.js
let isServerReady = false;

// ── Chemin userData — injecté dans TOUS les processus enfants (P0-A)
const USER_DATA_PATH = app.getPath('userData');

// ── Détection du mode d'exécution par la présence du build standalone
const STANDALONE_SERVER = path.join(__dirname, '.next', 'standalone', 'server.js');
const isDev = !fs.existsSync(STANDALONE_SERVER);

// ── Fenêtre principale et processus serveur Next.js
let mainWindow   = null;
let splashWindow = null;
let nextProcess  = null;  // Référence au processus enfant Next.js (prod uniquement)

// ══════════════════════════════════════════════════════════════════════
// UTILITAIRES DE PORT
// ══════════════════════════════════════════════════════════════════════

const DEV_PORT_RANGE_START = 3000;
const DEV_PORT_RANGE_END   = 3009;  // Next.js essaie jusqu'à 3009 en cas de conflit
const MAX_PORT_SCAN        = 10;    // Nombre max de ports à tester

/**
 * [FIX-2] Trouve un port libre en testant de preferred jusqu'à preferred + MAX_PORT_SCAN.
 * Contrairement à l'ancienne version (fallback unique +1), cette version boucle.
 *
 * @param {number} preferred - Port de départ préféré
 * @returns {Promise<number>} - Premier port disponible trouvé
 */
function findAvailablePort(preferred = 3000) {
  return new Promise((resolve, reject) => {
    let attempt = preferred;

    const tryPort = () => {
      if (attempt > preferred + MAX_PORT_SCAN) {
        reject(new Error(`[main] Aucun port libre trouvé dans la plage [${preferred}-${preferred + MAX_PORT_SCAN}]`));
        return;
      }

      const srv = http.createServer();
      srv.listen(attempt, '127.0.0.1', () => {
        const port = (srv.address()).port;
        srv.close(() => resolve(port));
      });
      srv.on('error', () => {
        attempt++;
        tryPort();
      });
    };

    tryPort();
  });
}

/**
 * [FIX-3] En mode développement, sonde la plage de ports pour trouver
 * sur lequel `next dev` écoute effectivement. Next.js peut choisir 3001, 3002…
 * si 3000 est occupé. Retourne le port répondant le plus tôt, ou null.
 *
 * @param {number} start - Port de début de plage
 * @param {number} end - Port de fin de plage
 * @param {number} timeoutMs - Timeout par requête
 * @returns {Promise<number | null>}
 */
function scanForDevServer(start = DEV_PORT_RANGE_START, end = DEV_PORT_RANGE_END, timeoutMs = 500) {
  const checks = [];

  for (let port = start; port <= end; port++) {
    const p = new Promise((resolve) => {
      const req = http.get(
        { hostname: '127.0.0.1', port, path: '/', timeout: timeoutMs },
        (res) => {
          res.resume();
          resolve(port);
        }
      );
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
    checks.push(p);
  }

  return Promise.all(checks).then((results) => {
    const found = results.find((p) => p !== null);
    return found ?? null;
  });
}

/**
 * Attend que le serveur Next.js accepte les connexions HTTP.
 * Retry toutes les 300ms jusqu'au timeout.
 *
 * @param {string} url - URL à sonder
 * @param {number} timeoutMs - Timeout total
 * @returns {Promise<void>}
 */
function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) return;
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: false,
    resizable: false,
    show: false,
    backgroundColor: '#09090b',
    icon: path.join(__dirname, 'public', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const splashPath = path.join(__dirname, 'public', 'splash.html');
  splashWindow.loadFile(splashPath).catch(() => {});
  splashWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show();
    }
  });
}

/**
 * Attend que le serveur Next.js réponde 200 OK sur /api/health.
 * Retry toutes les 300ms jusqu'au timeout.
 *
 * @param {string} baseUrl - URL de base du serveur (ex: http://127.0.0.1:3000)
 * @param {number} timeoutMs - Timeout total
 * @returns {Promise<void>}
 */
function waitForServer(baseUrl, timeoutMs = 25000) {
  createSplashWindow();
  const healthUrl = `${baseUrl}/api/health`;
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      const req = http.get(healthUrl, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(rawData);
              if (data && data.status === 'ok') {
                isServerReady = true;
                resolve();
                return;
              }
            } catch (e) {
              // Parse error, continuer à attendre
            }
          }
          retry();
        });
      });

      req.on('error', () => retry());
      req.on('timeout', () => {
        req.destroy();
        retry();
      });

      req.setTimeout(1000); // Timeout par requête individuelle

      function retry() {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`[main] Timeout (${timeoutMs / 1000}s): le serveur Next.js ne répond pas sur ${healthUrl}`));
        } else {
          setTimeout(check, 300);
        }
      }
    };

    check();
  });
}

// ══════════════════════════════════════════════════════════════════════
// GESTION DU PROCESSUS ENFANT NEXT.JS
// ══════════════════════════════════════════════════════════════════════

/**
 * [FIX-4] Tue proprement le processus enfant Next.js.
 * Appelé sur plusieurs événements de sortie pour garantir
 * qu'aucun processus zombie ne reste accroché sur le port.
 */
function killNextProcess() {
  if (nextProcess && !nextProcess.killed) {
    try {
      // SIGTERM d'abord (arrêt propre), puis SIGKILL après 3s si nécessaire
      nextProcess.kill('SIGTERM');
      const forceKillTimer = setTimeout(() => {
        if (nextProcess && !nextProcess.killed) {
          console.warn('[main] Forçage SIGKILL sur le serveur Next.js');
          nextProcess.kill('SIGKILL');
        }
      }, 3000);
      // Annuler le timer si le processus se termine proprement
      nextProcess.once('exit', () => clearTimeout(forceKillTimer));
    } catch (e) {
      // Ignorer les erreurs si le processus est déjà mort
    }
    nextProcess = null;
  }
}

/**
 * Démarre le serveur Next.js standalone en production.
 *
 * @param {number} port - Port sur lequel le serveur doit écouter
 * @returns {Promise<void>} - Résout quand le serveur est prêt
 */
async function startNextServer(port) {
  nextProcess = spawn(process.execPath, [STANDALONE_SERVER], {
    env: {
      ...process.env,
      ELECTRON_USERDATA_PATH: USER_DATA_PATH, // [P0-A] Transmission EXPLICITE
      PORT: String(port),
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: 'ignore',  // En prod, ne pas polluer stdout du processus principal
  });

  nextProcess.on('error', (err) => {
    console.error('[main] Erreur du processus Next.js:', err.message);
  });

  nextProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`[main] Le serveur Next.js s'est arrêté avec le code ${code} (signal: ${signal})`);
    }
    nextProcess = null;
  });

  await waitForServer(`http://127.0.0.1:${port}`, 25000);
}

// ══════════════════════════════════════════════════════════════════════
// Fenêtre principale
// ══════════════════════════════════════════════════════════════════════

async function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: "L'Étoile — Gestion & Facturation",
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,         // Requis pour better-sqlite3
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: !isDev,
    },
    icon: path.join(__dirname, 'public', 'icon.png'),
    show: false,
    backgroundColor: '#030303',
  });

  const appUrl = `http://127.0.0.1:${port}`;

  if (!isServerReady) {
    createSplashWindow();
    console.log(`[main] Attente de disponibilité sur /api/health avant affichage...`);
    try {
      await waitForServer(`http://127.0.0.1:${port}`, 25000);
    } catch (err) {
      console.error('[main] Avertissement health check:', err.message);
    }
  }

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  mainWindow.loadURL(appUrl).catch((err) => {
    mainWindow.loadURL(
      `data:text/html,<html><body style="background:#0a0a0a;color:#f87171;font-family:sans-serif;padding:2rem">` +
      `<h1>Erreur de chargement</h1><pre style="color:#94a3b8">${err.message}</pre>` +
      `<p style="color:#64748b">Lancez d'abord <code>npm run dev</code> puis relancez Electron.</p></body></html>`
    );
  });

  // [FIX-3] En dev, si le chargement échoue, tenter de re-scanner le bon port
  // (le serveur dev a peut-être changé de port depuis le démarrage d'Electron)
  let retryCount = 0;
  const MAX_RETRIES = 5;

  mainWindow.webContents.on('did-fail-load', async (_event, errorCode, _desc, validatedURL) => {
    if (!isDev) return; // En production, ne pas retry automatiquement
    if (!validatedURL || !validatedURL.includes('127.0.0.1')) return;
    if (retryCount >= MAX_RETRIES) return;

    retryCount++;

    await new Promise((r) => setTimeout(r, 1000));

    if (!mainWindow || mainWindow.isDestroyed()) return;

    // Re-scanner pour trouver le bon port actif du serveur dev
    const foundPort = await scanForDevServer();
    if (foundPort && foundPort !== port) {
      mainWindow.loadURL(`http://127.0.0.1:${foundPort}`);
    } else if (foundPort === port) {
      mainWindow.reload();
    } else {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();
      }, 1500);
    }
  });

  // DevTools uniquement en dev
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Intercepter les liens externes → navigateur OS
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ══════════════════════════════════════════════════════════════════════
// Lifecycle
// ══════════════════════════════════════════════════════════════════════

app.whenReady().then(async () => {
  let port;

  if (isDev) {
    // [FIX-3] Sonder la plage de ports pour trouver le serveur dev actif
    const foundPort = await scanForDevServer();

    if (foundPort) {
      port = foundPort;
    } else {
      // Aucun serveur dev actif → utiliser 3000 par défaut et laisser
      // did-fail-load + retry gérer la reconnexion quand next dev démarre
      port = DEV_PORT_RANGE_START;
      console.warn('[main] Aucun serveur Next.js dev trouvé. Lancez `npm run dev` dans un autre terminal.');
    }
  } else {
    // Production : trouver un port libre et démarrer le serveur standalone
    port = await findAvailablePort(3000);
    await startNextServer(port);
  }

  createWindow(port);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(port);
    }
  });
});

// [FIX-4] Nettoyage propre sur TOUS les événements de sortie ──────────────────

app.on('before-quit', () => {
  killNextProcess();
});

app.on('window-all-closed', () => {
  killNextProcess();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Sécurité supplémentaire : tuer le processus enfant même si Node.js sort
// brutalement (Ctrl+C, crash Electron, etc.)
process.on('exit', () => {
  killNextProcess();
});

process.on('SIGINT', () => {
  killNextProcess();
  process.exit(0);
});

process.on('SIGTERM', () => {
  killNextProcess();
  process.exit(0);
});

// ══════════════════════════════════════════════════════════════════════
// IPC HANDLERS (Tous async via ipcMain.handle, jamais sendSync)
// ══════════════════════════════════════════════════════════════════════

/**
 * Déclenche l'impression native via la boîte de dialogue système.
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

/** Expose la version de l'application au renderer. */
ipcMain.handle('app:get-version', () => app.getVersion());

/**
 * Expose le chemin userData au renderer (affichage dans l'UI Paramètres).
 * Ce chemin est aussi injecté dans le processus enfant Next.js via spawn().env.
 */
ipcMain.handle('app:get-userData-path', () => USER_DATA_PATH);
