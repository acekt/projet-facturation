/**
 * main.js — Processus Principal Electron "L'Étoile"
 * ===================================================
 *
 * CORRECTIONS PHASE 3-BIS (Stabilité & Conflits de ports) :
 *
 *  [FIX-1] isDev : Basé sur l'absence de .next/standalone/server.js plutôt
 *          que sur NODE_ENV.
 *  [FIX-2] findAvailablePort : Boucle jusqu'à MAX_PORT_SCAN ports.
 *  [FIX-3] Dev mode — sondage dynamique du port.
 *  [FIX-4] Cycle de vie propre : killNextProcess() avec Hard Kill Windows.
 *  [P0-A]  ELECTRON_USERDATA_PATH passé explicitement dans spawn().env.
 *  [P0-B]  output: 'standalone' → .next/standalone/server.js
 *
 * AUDIT PHASE 4 (Résilience Production) :
 *  [AUDIT-1] Logger fichier persistant (main.log dans userData).
 *  [AUDIT-2] Hard Kill anti-zombie Windows via taskkill /T /F.
 *  [AUDIT-3] Purge du cache Next.js + cwd: USER_DATA_PATH dans spawn.
 *  [AUDIT-4] Fallback UI production-ready + retry inconditionnel.
 */

'use strict';

const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
Menu.setApplicationMenu(null);
const { spawn, execSync }                     = require('child_process');
const path                                    = require('path');
const http                                    = require('http');
const fs                                      = require('fs');

// Prévention de l'avertissement MaxListenersExceeded
process.setMaxListeners(20);

// Verrou global strict de disponibilité du serveur Next.js
let isServerReady = false;

// ── Chemin userData — injecté dans TOUS les processus enfants (P0-A)
const USER_DATA_PATH = app.getPath('userData');

// ══════════════════════════════════════════════════════════════════════
// [AUDIT-1] LOGGER FICHIER PERSISTANT
// Écrit dans AppData/Roaming/L'Etoile/main.log
// Console.log() disparaît en prod — ce fichier reste pour le support.
// ══════════════════════════════════════════════════════════════════════
const LOG_PATH = path.join(USER_DATA_PATH, 'main.log');
let logStream = null;
try {
  if (!fs.existsSync(USER_DATA_PATH)) {
    fs.mkdirSync(USER_DATA_PATH, { recursive: true });
  }
  logStream = fs.createWriteStream(LOG_PATH, { flags: 'a' });
} catch (e) {
  // Si le fichier de log ne peut pas être créé, dégradation silencieuse
  logStream = null;
}

function logToFile(level, message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] ${message}\n`;
  if (logStream) logStream.write(entry);
  if (level === 'ERROR' || level === 'WARN') {
    console.error(entry.trim());
  } else {
    console.log(entry.trim());
  }
}

// ── Chemin vers server.js de Next.js Standalone
//
// DEV  : .next/standalone/server.js (relatif au projet)
// PROD : resources/standalone/server.js (via extraResources dans electron-builder)
//
// process.resourcesPath pointe vers le dossier resources/ de l'app Electron.
// extraResources copie .next/standalone → resources/standalone/ SANS filtrage,
// préservant intégralement le node_modules tree-shaked de Next.js.
const isDev = !app.isPackaged;
const STANDALONE_SERVER = isDev
  ? path.join(__dirname, '.next', 'standalone', 'server.js')
  : path.join(process.resourcesPath, 'standalone', 'server.js');

logToFile('INFO', `Démarrage — mode: ${isDev ? 'DÉVELOPPEMENT' : 'PRODUCTION'} | userData: ${USER_DATA_PATH}`);

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
 *
 * Architecture : boucle while async avec await 1 s entre chaque tentative
 * pour éviter le DDoS local (centaines de requêtes/seconde).
 * Chaque requête HTTP a un timeout individuel de 2 s.
 *
 * @param {string} baseUrl  - URL de base (ex: http://127.0.0.1:3000)
 * @param {number} timeoutMs - Timeout total en ms (défaut : 60 s)
 * @returns {Promise<void>}
 */
function waitForServer(baseUrl, timeoutMs = 60000) {
  createSplashWindow();
  const healthUrl = `${baseUrl}/api/health`;

  /** Effectue UN seul ping HTTP, résout avec true si 200+ok, false sinon. */
  function probe() {
    return new Promise((resolve) => {
      const req = http.get(healthUrl, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(rawData);
              if (data && data.status === 'ok') {
                resolve(true);
                return;
              }
            } catch (_) {
              // Réponse non-JSON ou status inattendu → réessayer
            }
          }
          resolve(false);
        });
      });

      req.on('error', () => resolve(false));   // ECONNREFUSED, ETIMEDOUT, etc.
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.setTimeout(2000); // Timeout par requête individuelle (2 s)
    });
  }

  /** Délai asynchrone strict : UN seul appel par seconde maximum. */
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  return (async () => {
    const start = Date.now();
    logToFile('INFO', `[Health] Démarrage du polling sur ${healthUrl} (timeout: ${timeoutMs / 1000}s)`);

    while (true) {
      const ok = await probe();

      if (ok) {
        isServerReady = true;
        logToFile('INFO', '[Health] Serveur Next.js prêt ✓');
        return; // Sortie propre → loadURL() sera appelé par l'appelant
      }

      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `[main] Timeout (${timeoutMs / 1000}s) : le serveur Next.js ne répond pas sur ${healthUrl}`
        );
      }

      // ── Pause stricte de 1 s avant la prochaine tentative ──────────────
      // Garantit au maximum 1 requête/seconde → zéro DDoS local.
      await sleep(1000);
    }
  })();
}


// ══════════════════════════════════════════════════════════════════════
// GESTION DU PROCESSUS ENFANT NEXT.JS
// ══════════════════════════════════════════════════════════════════════

/**
 * [AUDIT-2] Hard Kill anti-zombie du processus enfant Next.js.
 *
 * Problème Windows : SIGTERM ne propage PAS aux processus enfants.
 * Les workers de Next.js (cache, image opt, etc.) deviennent des zombies
 * accrochés sur le port. Seul `taskkill /T /F` détruit tout l'arbre.
 *
 * Sur Unix, process.kill(-pid) cible le process group entier (même effet).
 */
function killNextProcess() {
  if (nextProcess && !nextProcess.killed) {
    const pid = nextProcess.pid;
    logToFile('INFO', `[Shutdown] Destruction de l'arbre de processus Next.js (PID: ${pid})...`);
    try {
      if (process.platform === 'win32') {
        // /F : Force, /T : Tree (tous les enfants), /PID : cible par PID
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
        logToFile('INFO', `[Shutdown] taskkill /pid ${pid} /T /F — succès.`);
      } else {
        // Signe négatif → envoie le signal à tout le process group Unix
        // Requiert detached: true dans spawn() (voir startNextServer)
        process.kill(-pid, 'SIGKILL');
        logToFile('INFO', `[Shutdown] SIGKILL envoyé au process group -${pid} — succès.`);
      }
    } catch (e) {
      // Le processus est peut-être déjà mort — c'est acceptable
      logToFile('WARN', `[Shutdown] Erreur lors du kill (déjà terminé ?) : ${e.message}`);
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
  const crypto = require('crypto');

  // ════════════════════════════════════════════════════════════════════
  // GESTION DES SECRETS PERSISTANTS
  //
  // Problème : crypto.randomBytes() génère un secret différent à chaque
  // lancement. Cela invalide TOUTES les sessions actives ET rend les
  // mots de passe hachés impossibles à vérifier (PASSWORD_SALT change).
  //
  // Solution : générer les secrets UNE SEULE FOIS, les persister dans
  // userData/secrets.json, et les relire à chaque démarrage.
  //
  // Sécurité : ce fichier est dans AppData — accessible uniquement à
  // l'utilisateur courant. Ne jamais le versionner dans Git.
  // ════════════════════════════════════════════════════════════════════
  const SECRETS_FILE = path.join(USER_DATA_PATH, 'secrets.json');
  let appSecrets;

  try {
    if (fs.existsSync(SECRETS_FILE)) {
      // Relecture des secrets existants
      const raw = fs.readFileSync(SECRETS_FILE, 'utf8');
      appSecrets = JSON.parse(raw);
      // Validation de l'intégrité : si un secret est absent ou trop court, régénérer
      if (
        !appSecrets.SESSION_SECRET || appSecrets.SESSION_SECRET.length < 32 ||
        !appSecrets.PASSWORD_SALT  || appSecrets.PASSWORD_SALT.length  < 16
      ) {
        throw new Error('Secrets corrompus ou trop courts — régénération forcée.');
      }
      logToFile('INFO', '[Secrets] Secrets persistants chargés depuis userData.');
    } else {
      throw new Error('Fichier secrets.json absent — première initialisation.');
    }
  } catch (secretsErr) {
    // Première exécution OU secrets corrompus → génération et persistance
    logToFile('INFO', `[Secrets] ${secretsErr.message}`);
    appSecrets = {
      SESSION_SECRET: crypto.randomBytes(48).toString('hex'),  // 96 chars → >> 32 min
      PASSWORD_SALT:  crypto.randomBytes(24).toString('hex'),  // 48 chars → >> 16 min
    };
    try {
      fs.writeFileSync(SECRETS_FILE, JSON.stringify(appSecrets, null, 2), { mode: 0o600 });
      logToFile('INFO', `[Secrets] Nouveaux secrets générés et persistés : ${SECRETS_FILE}`);
    } catch (writeErr) {
      logToFile('ERROR', `[Secrets] Impossible de persister les secrets : ${writeErr.message}`);
    }
  }

  // [AUDIT-3] Purge du cache Next.js dans userData avant démarrage.
  // En prod (ASAR read-only), Next.js tenterait d'écrire dans l'archive
  // et échouerait silencieusement. On le force à écrire dans userData via cwd.
  const nextCacheDir = path.join(USER_DATA_PATH, '.next');
  try {
    if (fs.existsSync(nextCacheDir)) {
      fs.rmSync(nextCacheDir, { recursive: true, force: true });
      logToFile('INFO', `[Cache] Dossier .next purgé dans userData.`);
    }
  } catch (cacheErr) {
    logToFile('WARN', `[Cache] Impossible de purger le cache: ${cacheErr.message}`);
  }

  logToFile('INFO', `[Server] Démarrage de Next.js standalone sur le port ${port}...`);

  nextProcess = spawn(process.execPath, [STANDALONE_SERVER], {
    // [AUDIT-3] cwd: userData → Next.js écrira son cache dans AppData (accessible en écriture)
    cwd: USER_DATA_PATH,
    // [AUDIT-2] detached: true sur Unix → permet process.kill(-pid) (group kill)
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',              // Force Electron à agir comme Node.js, pas GUI
      ELECTRON_USERDATA_PATH: USER_DATA_PATH, // [P0-A] Transmission EXPLICITE du chemin userData
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      // Secrets persistants — stables entre les redémarrages
      SESSION_SECRET: appSecrets.SESSION_SECRET,
      PASSWORD_SALT:  appSecrets.PASSWORD_SALT,
    },
    stdio: 'pipe',
  });

  // [AUDIT-1] Toutes les sorties du process enfant → logger fichier persistant
  nextProcess.stdout.on('data', (data) => logToFile('INFO', `[Next.js] ${data.toString().trim()}`));
  nextProcess.stderr.on('data', (data) => logToFile('ERROR', `[Next.js] ${data.toString().trim()}`));

  nextProcess.on('error', (err) => {
    logToFile('ERROR', `[Next.js Spawn] Erreur de démarrage: ${err.message}`);
  });

  nextProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      logToFile('ERROR', `[Next.js Exit] Code: ${code} | Signal: ${signal}`);
    } else {
      logToFile('INFO', `[Next.js Exit] Arrêt propre (code: ${code}).`);
    }
    nextProcess = null;
  });

  await waitForServer(`http://127.0.0.1:${port}`, 60000);
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

  // [AUDIT-4] Fallback UI production-ready avec bouton de réessai.
  // Remplace l'ancien message orienté développeur ("npm run dev").
  const loadApp = () => {
    mainWindow.loadURL(appUrl).catch((err) => {
      logToFile('ERROR', `[UI] Échec de mainWindow.loadURL: ${err.message}`);
      const errorHtml = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Démarrage en cours...</title></head>
<body style="background:#09090b;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;gap:16px;">
  <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="#ef4444" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
  </svg>
  <h1 style="margin:0;font-size:1.25rem;color:#ef4444">Le service de facturation prend du temps à démarrer</h1>
  <p style="margin:0;color:#a1a1aa;max-width:480px;text-align:center;line-height:1.6">
    Le moteur local s'initialise (SQLite, cache...). Ce délai est normal au premier démarrage ou sur les machines lentes.
  </p>
  <p style="margin:0;font-family:monospace;font-size:0.75rem;background:#18181b;padding:8px 16px;border-radius:6px;color:#71717a;max-width:480px;word-break:break-all">
    ${err.message}
  </p>
  <button onclick="window.location.reload()" style="margin-top:8px;padding:10px 24px;background:#3b82f6;border:none;
    border-radius:8px;color:white;cursor:pointer;font-weight:600;font-size:0.9rem;letter-spacing:0.02em;
    transition:background 0.2s" onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
    Réessayer
  </button>
  <p style="margin:0;font-size:0.7rem;color:#3f3f46">Journal de débogage : ${LOG_PATH}</p>
</body></html>`;
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
    });
  };

  if (!isServerReady) {
    createSplashWindow();
    logToFile('INFO', `[UI] Attente de /api/health sur le port ${port}...`);
    waitForServer(`http://127.0.0.1:${port}`, 25000)
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

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  // [AUDIT-4] Retry inconditionnel (dev ET prod) avec délai de 2s.
  // Suppression du `if (!isDev) return` qui empêchait la reconnexion en production
  // sur machines lentes (démarrage SQLite > 25s).
  let retryCount = 0;
  const MAX_RETRIES = 5;

  mainWindow.webContents.on('did-fail-load', async (_event, errorCode, _desc, validatedURL) => {
    if (!validatedURL || !validatedURL.includes('127.0.0.1')) return;
    if (retryCount >= MAX_RETRIES) {
      logToFile('ERROR', `[UI] Abandon après ${MAX_RETRIES} tentatives de rechargement.`);
      return;
    }

    retryCount++;
    logToFile('WARN', `[UI] did-fail-load (code: ${errorCode}) — tentative ${retryCount}/${MAX_RETRIES} dans 2s...`);

    // 2s de délai (vs 1s avant) pour laisser le temps aux machines lentes
    await new Promise((r) => setTimeout(r, 2000));
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (isDev) {
      // En dev : re-scanner le port au cas où next dev a changé
      const foundPort = await scanForDevServer();
      if (foundPort && foundPort !== port) {
        mainWindow.loadURL(`http://127.0.0.1:${foundPort}`);
      } else {
        mainWindow.reload();
      }
    } else {
      // En prod : simple reload — le serveur standalone devrait répondre maintenant
      mainWindow.reload();
    }
  });

  // DevTools uniquement en dev
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // ══════════════════════════════════════════════════════════════════════
  // CONFINEMENT STRICT — Aucune navigation ne doit s'échapper vers le
  // navigateur système. Toutes les URLs locales restent dans la
  // BrowserWindow. Seules les URLs véritablement externes (mailto:, etc.)
  // sont envoyées au navigateur OS.
  // ══════════════════════════════════════════════════════════════════════

  const LOCAL_ORIGIN = `http://127.0.0.1:${port}`;

  // Bloque TOUTES les pop-ups (window.open, target="_blank", etc.).
  // Les URLs locales sont chargées dans la fenêtre principale.
  // Les URLs véritablement externes (pas localhost/127.0.0.1) sont ignorées silencieusement.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(LOCAL_ORIGIN) || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      // URL locale → charger dans la fenêtre principale au lieu d'ouvrir une pop-up
      mainWindow.loadURL(url);
    } else {
      // URL externe → NE PAS ouvrir dans le navigateur système
      // On pourrait utiliser shell.openExternal(url) ici si on voulait,
      // mais la consigne est de ne JAMAIS ouvrir le navigateur OS.
      logToFile('WARN', `[Confinement] Pop-up externe bloquée: ${url}`);
    }
    return { action: 'deny' };
  });

  // Intercepte les navigations de page (redirections serveur, clics sur <a>, etc.).
  // Les URLs locales sont autorisées. Tout le reste est bloqué silencieusement.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Autorise la navigation vers le serveur local (Next.js)
    if (url.startsWith(LOCAL_ORIGIN) || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      return; // Navigation autorisée — pas de event.preventDefault()
    }
    // Autorise les data: URIs (utilisés par le fallback UI)
    if (url.startsWith('data:')) {
      return;
    }
    // Toute autre URL → bloquer silencieusement
    event.preventDefault();
    logToFile('WARN', `[Confinement] Navigation externe bloquée: ${url}`);
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
      // [FIX-IPv4] Attendre que le serveur dev soit pleinement prêt avant de charger l'UI.
      // Même chose qu'en production — évite ERR_CONNECTION_REFUSED au démarrage rapide.
      logToFile('INFO', `[Dev] Serveur trouvé sur le port ${port} — attente du health check...`);
      try {
        await waitForServer(`http://127.0.0.1:${port}`, 60000);
      } catch (e) {
        logToFile('WARN', `[Dev] Health check timeout: ${e.message} — tentative de chargement quand même.`);
      }
    } else {
      // Aucun serveur dev actif → utiliser 3000 par défaut et laisser
      // did-fail-load + retry gérer la reconnexion quand next dev démarre
      port = DEV_PORT_RANGE_START;
      logToFile('WARN', '[main] Aucun serveur Next.js dev trouvé — lancez `npm run dev` dans un autre terminal.');
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
 * (Ancien système, imprime la fenêtre entière).
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
 * 🚨 NOUVEAU MOTEUR D'IMPRESSION (Fenêtre Cachée) 🚨
 * Permet d'imprimer un document formel (A4) sans imprimer l'interface web (modales, etc.)
 * et contourne le bug de "Cette application ne prend pas en charge l'aperçu" sous Windows.
 */
ipcMain.handle('print-document', async (event, htmlContent) => {
  return new Promise((resolve, reject) => {
    // 1. Création d'une fenêtre invisible
    let printWin = new BrowserWindow({
      show: false, // Inivisible pour l'utilisateur
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      }
    });

    // 2. Écriture du HTML dans un fichier temporaire dans userData
    // On utilise un fichier physique pour éviter les limites de taille des Data URIs
    // et s'assurer que Chromium gère correctement le rendu.
    const tempPath = path.join(USER_DATA_PATH, `print_temp_${Date.now()}.html`);
    
    try {
      fs.writeFileSync(tempPath, htmlContent, 'utf8');
    } catch (err) {
      logToFile('ERROR', `[Print] Impossible d'écrire le fichier temp: ${err.message}`);
      printWin.destroy();
      return reject(new Error('Erreur de préparation du document.'));
    }

    let isSettled = false;

    // Timeout de sécurité (15s) pour éviter un memory leak si le chargement bloque
    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        logToFile('ERROR', `[Print] Timeout de 15s atteint lors de la génération.`);
        if (printWin && !printWin.isDestroyed()) {
          printWin.webContents.removeAllListeners('did-finish-load');
          printWin.webContents.removeAllListeners('did-fail-load');
          printWin.destroy();
          printWin = null;
        }
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
        reject(new Error('Timeout lors de la préparation du document.'));
      }
    }, 15000);

    // 3. Une fois chargé, on lance l'impression
    printWin.webContents.on('did-finish-load', () => {
      if (isSettled) return;

      logToFile('INFO', '[Print] Fenêtre cachée chargée, lancement de print()');
      
      printWin.webContents.print({ 
        silent: false, 
        printBackground: true,
        // On peut forcer des paramètres spécifiques ici si besoin
      }, (success, errorType) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timer);

        // Nettoyage : fermeture de la fenêtre et suppression du fichier temp
        if (printWin && !printWin.isDestroyed()) {
          printWin.destroy();
        }
        printWin = null;
        
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch (e) {
          logToFile('WARN', `[Print] Impossible de supprimer le fichier temp: ${e.message}`);
        }

        if (success) {
          resolve({ success: true });
        } else {
          logToFile('WARN', `[Print] Impression annulée ou échouée: ${errorType}`);
          reject(new Error(errorType));
        }
      });
    });

    // Gestion des erreurs de chargement
    printWin.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);

      logToFile('ERROR', `[Print] Échec du chargement de la page d'impression: ${errorDescription}`);
      if (printWin && !printWin.isDestroyed()) {
        printWin.destroy();
      }
      printWin = null;
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
      reject(new Error('Échec du rendu du document.'));
    });

    // 4. Chargement du fichier
    printWin.loadFile(tempPath).catch(() => {});
  });
});

/** Expose la version de l'application au renderer. */
ipcMain.handle('app:get-version', () => app.getVersion());

/**
 * Expose le chemin userData au renderer (affichage dans l'UI Paramètres).
 * Ce chemin est aussi injecté dans le processus enfant Next.js via spawn().env.
 */
ipcMain.handle('app:get-userData-path', () => USER_DATA_PATH);

// ══════════════════════════════════════════════════════════════════════
// HANDLER : export-pdf
// Génère un PDF haute fidélité via printToPDF (fond complet inclus)
// et sauvegarde via la boîte de dialogue native du système.
// ══════════════════════════════════════════════════════════════════════

/**
 * Handler IPC — 'export-pdf'
 *
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {string} htmlContent       - HTML complet à rendre (généré par electron-print.ts)
 * @param {string} defaultFilename   - Nom de fichier par défaut (ex: "FACTURE_001.pdf")
 * @returns {Promise<{ saved: boolean, filePath?: string }>}
 */
ipcMain.handle('export-pdf', async (event, htmlContent, defaultFilename = 'document.pdf') => {
  const tempPath = path.join(USER_DATA_PATH, `pdf_temp_${Date.now()}.html`);
  let pdfWin = null;

  try {
    // 1. Écriture du HTML dans un fichier temporaire (physique, pas data URI)
    //    Évite les limites de taille et garantit le chargement de Tailwind CDN.
    fs.writeFileSync(tempPath, htmlContent, 'utf8');
    logToFile('INFO', `[PDF] Fichier HTML temp écrit : ${tempPath}`);

    // 2. Création d'une fenêtre Chromium invisible pour le rendu
    pdfWin = new BrowserWindow({
      show: false,
      width: 794,   // Largeur A4 à 96 dpi
      height: 1123, // Hauteur A4 à 96 dpi
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // Pas de preload nécessaire — fenêtre interne sans UI React
      },
    });

    // Timeout de sécurité (15s)
    const loadPromise = pdfWin.loadFile(tempPath);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout lors du chargement de la page pour le PDF.")), 15000);
    });

    // 3. Chargement du HTML et attente du rendu complet
    await Promise.race([loadPromise, timeoutPromise]);
    logToFile('INFO', '[PDF] Fenêtre cachée chargée, démarrage de printToPDF...');

    // 4. Génération du buffer PDF via l'API native Chromium avec Timeout
    const printPromise = pdfWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      marginsType: 1, // 0=défaut, 1=aucune marge, 2=marges minimales
      landscape: false,
    });

    const printTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout lors de la génération du PDF.")), 15000);
    });

    const pdfBuffer = await Promise.race([printPromise, printTimeoutPromise]);
    logToFile('INFO', `[PDF] Buffer généré (${pdfBuffer.length} octets)`);

    // 5. Boîte de dialogue de sauvegarde native
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Enregistrer le document PDF',
      defaultPath: path.join(app.getPath('documents'), defaultFilename),
      filters: [{ name: 'Fichier PDF', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) {
      logToFile('INFO', '[PDF] Sauvegarde annulée par l\'utilisateur.');
      return { saved: false };
    }

    // 6. Écriture du fichier PDF sur le disque
    await fs.promises.writeFile(filePath, pdfBuffer);
    logToFile('INFO', `[PDF] Fichier sauvegardé : ${filePath}`);

    // 7. (Optionnel) Ouvre le dossier de destination dans l'explorateur
    // shell.showItemInFolder(filePath);

    return { saved: true, filePath };

  } catch (err) {
    logToFile('ERROR', `[PDF] Erreur lors de la génération : ${err.message}`);
    throw err; // Re-throw — le renderer recev ra une rejection via IPC

  } finally {
    // 8. Nettoyage systématique — même en cas d'erreur
    if (pdfWin && !pdfWin.isDestroyed()) {
      pdfWin.destroy();
      pdfWin = null;
    }
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      logToFile('INFO', `[PDF] Fichier temp nettoyé : ${tempPath}`);
    } catch (cleanErr) {
      logToFile('WARN', `[PDF] Impossible de nettoyer le temp : ${cleanErr.message}`);
    }
  }
});
