'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { utilityProcess } = require('electron');

const DEV_PORT_RANGE_START = 3000;
const DEV_PORT_RANGE_END   = 3009;
const MAX_PORT_SCAN        = 10;

let nextProcess = null;

/**
 * Trouve un port TCP libre en testant de preferred jusqu'à preferred + MAX_PORT_SCAN.
 * @param {number} preferred
 * @returns {Promise<number>}
 */
function findAvailablePort(preferred = 3000) {
  return new Promise((resolve, reject) => {
    let attempt = preferred;

    const tryPort = () => {
      if (attempt > preferred + MAX_PORT_SCAN) {
        reject(new Error(`[server] Aucun port libre trouvé dans la plage [${preferred}-${preferred + MAX_PORT_SCAN}]`));
        return;
      }

      const srv = http.createServer();
      srv.listen(attempt, '127.0.0.1', () => {
        const port = srv.address().port;
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
 * En mode développement, sonde la plage de ports pour trouver sur lequel Next.js écoute.
 * @param {number} start
 * @param {number} end
 * @param {number} timeoutMs
 * @returns {Promise<number | null>}
 */
function scanForDevServer(start = DEV_PORT_RANGE_START, end = DEV_PORT_RANGE_END, timeoutMs = 1500) {
  const checks = [];
  const hosts = ['127.0.0.1', 'localhost'];

  for (let port = start; port <= end; port++) {
    for (const hostname of hosts) {
      const p = new Promise((resolve) => {
        const req = http.get(
          { hostname, port, path: '/api/health', timeout: timeoutMs },
          (res) => {
            res.resume();
            resolve(port);
          }
        );
        req.on('error', () => resolve(null));
        req.on('timeout', () => {
          req.destroy();
          resolve(null);
        });
      });
      checks.push(p);
    }
  }

  return Promise.all(checks).then((results) => {
    const found = results.find((p) => p !== null);
    return found ?? null;
  });
}

/**
 * Résout le chemin vers server.js de Next.js Standalone.
 * @param {string} resourcesPath
 * @param {string} baseDir
 * @returns {string}
 */
function resolveStandaloneServer(resourcesPath, baseDir) {
  const candidates = [
    path.join(resourcesPath || '', 'standalone', 'apps', 'desktop', 'server.js'),
    path.join(resourcesPath || '', 'standalone', 'server.js'),
    path.join(resourcesPath || '', 'app.asar.unpacked', '.next', 'standalone', 'apps', 'desktop', 'server.js'),
    path.join(resourcesPath || '', 'app.asar.unpacked', '.next', 'standalone', 'server.js'),
    path.join(baseDir, '.next', 'standalone', 'apps', 'desktop', 'server.js'),
    path.join(baseDir, '.next', 'standalone', 'server.js'),
    path.join(resourcesPath || '', 'app', '.next', 'standalone', 'server.js'),
    path.join(baseDir, 'server.js'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const buildId = path.join(path.dirname(c), '.next', 'BUILD_ID');
      if (fs.existsSync(buildId)) {
        return c;
      }
    }
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return candidates[0];
}

/**
 * Attend que le serveur Next.js réponde 200 OK avec JSON { status: 'ok' } sur /api/health.
 * @param {string} baseUrl
 * @param {number} timeoutMs
 * @param {Function} logToFile
 * @param {Function} [onTick]
 * @returns {Promise<void>}
 */
function waitForServer(baseUrl, timeoutMs = 60000, logToFile, onTick) {
  const healthUrl = `${baseUrl}/api/health`;

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
            } catch (_) {}
          }
          resolve(false);
        });
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.setTimeout(2000);
    });
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function warmupRoot(url) {
    return new Promise((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
      req.setTimeout(25000);
    });
  }

  return (async () => {
    const start = Date.now();
    logToFile('INFO', `[Health] Démarrage du polling sur ${healthUrl} (timeout: ${timeoutMs / 1000}s)`);

    while (true) {
      if (onTick) onTick();
      const ok = await probe();

      if (ok) {
        logToFile('INFO', '[Health] Serveur Next.js prêt ✓ — Pré-compilation (warm-up) de la page...');
        try {
          await warmupRoot(`${baseUrl}/`);
          logToFile('INFO', '[Health] Pré-compilation Next.js terminée avec succès ✓');
        } catch (_) {
          // Warmup facultatif pour ne pas bloquer si délai dépassé
        }
        return;
      }

      if (Date.now() - start > timeoutMs) {
        throw new Error(`[server] Timeout (${timeoutMs / 1000}s) : le serveur Next.js ne répond pas sur ${healthUrl}`);
      }

      await sleep(250);
    }
  })();
}

/**
 * Hard kill anti-zombie Windows (taskkill /T /F) et Unix (process group kill).
 * @param {Function} logToFile
 */
function killNextProcess(logToFile) {
  if (nextProcess && !nextProcess.killed) {
    const pid = nextProcess.pid;
    logToFile('INFO', `[Shutdown] Destruction de l'arbre de processus Next.js (PID: ${pid})...`);
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
        logToFile('INFO', `[Shutdown] taskkill /pid ${pid} /T /F — succès.`);
      } else {
        process.kill(-pid, 'SIGKILL');
        logToFile('INFO', `[Shutdown] SIGKILL envoyé au process group -${pid} — succès.`);
      }
    } catch (e) {
      logToFile('WARN', `[Shutdown] Erreur lors du kill (déjà terminé ?) : ${e.message}`);
    }
    nextProcess = null;
  }
}

/**
 * Démarre le serveur Next.js standalone en production via utilityProcess.
 * @param {object} options
 * @param {number} options.port
 * @param {string} options.userDataPath
 * @param {string} options.standaloneServer
 * @param {object} options.appSecrets
 * @param {Function} options.logToFile
 * @returns {Promise<void>}
 */
async function startNextServer({ port, userDataPath, standaloneServer, appSecrets, logToFile }) {
  const nextCacheDir = path.join(userDataPath, '.next');
  try {
    if (fs.existsSync(nextCacheDir)) {
      fs.rmSync(nextCacheDir, { recursive: true, force: true });
      logToFile('INFO', '[Cache] Dossier .next purgé dans userData.');
    }
  } catch (cacheErr) {
    logToFile('WARN', `[Cache] Impossible de purger le cache: ${cacheErr.message}`);
  }

  logToFile('INFO', `[Server] Démarrage de Next.js standalone sur le port ${port}...`);

  let effectiveServer = standaloneServer;
  if (effectiveServer.includes('app.asar') && !effectiveServer.includes('app.asar.unpacked')) {
    const unpacked = effectiveServer.replace('app.asar', 'app.asar.unpacked');
    if (fs.existsSync(unpacked)) {
      effectiveServer = unpacked;
    }
  }

  let serverDir = path.dirname(effectiveServer);
  if (serverDir.includes('app.asar') && !serverDir.includes('app.asar.unpacked')) {
    serverDir = userDataPath;
  }

  const standaloneNodeModules = path.join(process.resourcesPath || '', 'standalone', 'node_modules');
  const serverNodeModules = path.join(serverDir, 'node_modules');
  const parentNodeModules = path.join(path.dirname(serverDir), 'node_modules');
  const rootNodeModules = path.join(path.dirname(path.dirname(serverDir)), 'node_modules');
  const nodePathEntries = [
    standaloneNodeModules,
    rootNodeModules,
    parentNodeModules,
    serverNodeModules,
    process.env.NODE_PATH || '',
  ].filter((p) => p && fs.existsSync(p));

  const resolvedNodePath = nodePathEntries.join(path.delimiter);
  logToFile('INFO', `[Server] Exécution Next.js: ${effectiveServer} (cwd: ${serverDir})`);
  if (resolvedNodePath) {
    logToFile('INFO', `[Server] NODE_PATH injecté: ${resolvedNodePath}`);
  }

  nextProcess = utilityProcess.fork(effectiveServer, [], {
    cwd: serverDir,
    env: {
      ...process.env,
      ELECTRON_USERDATA_PATH: userDataPath,
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      ...(resolvedNodePath ? { NODE_PATH: resolvedNodePath } : {}),
      SESSION_SECRET: appSecrets.SESSION_SECRET,
      PASSWORD_SALT: appSecrets.PASSWORD_SALT,
    },
    stdio: 'pipe',
  });

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

  await waitForServer(`http://127.0.0.1:${port}`, 60000, logToFile);
}

module.exports = {
  findAvailablePort,
  scanForDevServer,
  resolveStandaloneServer,
  waitForServer,
  killNextProcess,
  startNextServer,
};
