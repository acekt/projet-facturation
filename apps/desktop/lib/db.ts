import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { runMigrations } from './db/migrations';

/**
 * Résolution du chemin de la base de données SQLite — Architecture 3 niveaux.
 */
function resolveDatabasePath(): string {
  // ── TEST : chemin forcé pour la suite de tests (isolement total)
  const testDbPath = process.env['TEST_DB_PATH'];
  if (testDbPath) {
    const p = path.resolve(testDbPath);
    console.log(`[db] Niveau 0 (Test/E2E) : ${p}`);
    return p;
  }

  const dbFileName = process.env['DB_FILE_NAME'] || 'database.sqlite';

  // ── NIVEAU 1 : Production Electron (ELECTRON_USERDATA_PATH injecté par main.js)
  const electronUserDataPath = process.env['ELECTRON_USERDATA_PATH'];
  if (electronUserDataPath) {
    const dataDir = path.join(electronUserDataPath, 'data');
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const dbPath = path.resolve(path.join(dataDir, dbFileName));
      console.log(`[db] Niveau 1 (Electron userData) : ${dbPath}`);
      return dbPath;
    } catch (err) {
      console.error("[db] NIVEAU 1 ÉCHOUÉ — impossible d'écrire dans ELECTRON_USERDATA_PATH :", err);
    }
  }

  // ── NIVEAU 2 : Développement local (npm run dev)
  if (process.env.NODE_ENV !== 'production') {
    const cwd = process.cwd();
    try {
      const dataDir = path.join(cwd, 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const targetDbPath = path.resolve(path.join(dataDir, dbFileName));

      if (dbFileName === 'database.sqlite') {
        const legacyDbPath = path.resolve(path.join(cwd, 'database.sqlite'));
        if (!fs.existsSync(targetDbPath) && fs.existsSync(legacyDbPath)) {
          try {
            fs.copyFileSync(legacyDbPath, targetDbPath);
            console.log(`[db] Migration : ancienne base déplacée vers ${targetDbPath}`);
          } catch (migErr) {
            console.warn("[db] Échec de la migration de l'ancienne base :", migErr);
          }
        }
      }

      fs.accessSync(dataDir, fs.constants.W_OK);
      console.log(`[db] Niveau 2 (Dev/cwd) : ${targetDbPath}`);
      return targetDbPath;
    } catch (err) {
      console.error('[db] NIVEAU 2 ÉCHOUÉ — process.cwd()/data non accessible en écriture :', err);
    }
  }

  // ── NIVEAU 3 : Fallback absolu (homedir — jamais en lecture seule)
  const fallbackDir = path.join(os.homedir(), '.facturier-invoicing', 'data');
  try {
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
  } catch (err) {
    console.error('[db] NIVEAU 3 ÉCHOUÉ — impossible de créer le répertoire homedir :', err);
  }
  const fallbackPath = path.resolve(path.join(fallbackDir, dbFileName));
  console.warn(`[db] Niveau 3 (Fallback homedir) : ${fallbackPath}`);
  return fallbackPath;
}

const globalForDb = globalThis as unknown as {
  db: Database.Database;
  statementCache: Map<string, Database.Statement>;
  isClosing: boolean;
  db_ready: boolean;
};

const dbPath = resolveDatabasePath();

let db: Database.Database;
try {
  db = globalForDb.db || new Database(dbPath, { timeout: 5000 });
  if (!globalForDb.db) {
    globalForDb.db = db;
    globalForDb.db_ready = false;
  }
} catch (fatalErr: unknown) {
  const errMsg = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
  process.stderr.write(`[db] FATAL: Impossible d'ouvrir la base de données : ${dbPath}\n`);
  process.stderr.write(`[db] FATAL: ${errMsg}\n`);
  process.stderr.write(`[db] FATAL: Vérifiez l'ABI de better_sqlite3.node et les droits d'accès au répertoire.\n`);
  throw fatalErr;
}

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

const closeDb = () => {
  if (globalForDb.isClosing) return;
  globalForDb.isClosing = true;
  try {
    if (db && db.open) {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch {
        // Ignorer si la base est occupée ou verrouillée lors de l'arrêt
      }
      db.close();
      console.log('[db] Base de données SQLite fermée proprement (WAL Checkpoint & Close).');
    }
  } catch (err) {
    console.error('[db] Erreur lors de la fermeture de la base de données:', err);
  }
};

if (!globalForDb.isClosing) {
  process.on('exit', closeDb);
  process.on('beforeExit', closeDb);
  process.on('SIGINT', () => {
    closeDb();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    closeDb();
    process.exit(0);
  });
  process.on('SIGHUP', () => {
    closeDb();
    process.exit(0);
  });
  process.on('SIGBREAK', () => {
    closeDb();
    process.exit(0);
  });
}

const statementCache = globalForDb.statementCache || new Map<string, Database.Statement>();
globalForDb.statementCache = statementCache;

export function prepareCached(sql: string) {
  let stmt = statementCache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    statementCache.set(sql, stmt);
  }
  return stmt;
}

// ── Initialisation unique par processus et migrations versionnées (0001 -> 0003)
if (!globalForDb.db_ready) {
  try {
    runMigrations(db, dbPath);
    globalForDb.db.pragma('journal_mode = WAL');

    try {
      const { migrateInlineLogoToDisk } = require('./api/logo-storage');
      migrateInlineLogoToDisk(db);
    } catch (e) {
      console.error('Logo disk migration error:', e);
    }

    try {
      const { migrateLegacyDatabase } = require('./db/migrateLegacy');
      migrateLegacyDatabase(db, dbPath);
    } catch (e) {
      console.error('Legacy migration check error:', e);
    }

    if (!process.env.NEXT_BUILD) {
      globalForDb.db_ready = true;
      process.stdout.write(`[db] Schéma initialisé et migré avec succès : ${dbPath}\n`);
    }
  } catch (schemaErr: unknown) {
    const errMsg = schemaErr instanceof Error ? schemaErr.message : String(schemaErr);
    process.stderr.write(`[db] FATAL: Échec de l'initialisation/migration du schéma sur : ${dbPath}\n`);
    process.stderr.write(`[db] FATAL: ${errMsg}\n`);
    throw schemaErr;
  }
}

const dbProxy = new Proxy(db, {
  get(target, prop, receiver) {
    if (prop === 'prepare') {
      return prepareCached;
    }
    const value = Reflect.get(target, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(target);
    }
    return value;
  },
});

export default dbProxy;
