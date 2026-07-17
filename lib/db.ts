import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Résolution robuste du chemin de la base de données (Electron & Next.js).
 */
/**
 * Résolution robuste et persistante du chemin de la base de données (Electron & Next.js).
 * Garantie sans :memory: et stockée dans un sous-dossier persistant 'data'.
 */
function resolveDatabasePath(): string {
  if (process.env.TEST_DB_PATH) {
    return path.resolve(process.env.TEST_DB_PATH);
  }
  const dbFileName = process.env.DB_FILE_NAME || 'database.sqlite';
  const electronUserDataPath = process.env.ELECTRON_USERDATA_PATH;

  if (electronUserDataPath) {
    try {
      const dataDir = path.join(electronUserDataPath, 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      return path.resolve(path.join(dataDir, dbFileName));
    } catch (err) {
      console.warn('[db] Impossible d\'écrire dans ELECTRON_USERDATA_PATH, fallback sur le répertoire de travail:', err);
    }
  }

  const cwd = process.cwd();
  try {
    const dataDir = path.join(cwd, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const targetDbPath = path.resolve(path.join(dataDir, dbFileName));

    // Migration automatique d'une ancienne base située à la racine de cwd pour éviter toute perte lors de la transition
    if (dbFileName === 'database.sqlite') {
      const legacyDbPath = path.resolve(path.join(cwd, 'database.sqlite'));
      if (!fs.existsSync(targetDbPath) && fs.existsSync(legacyDbPath)) {
        try {
          fs.copyFileSync(legacyDbPath, targetDbPath);
          console.log(`[db] Ancienne base de données (racine) migrée vers ${targetDbPath}`);
        } catch (migErr) {
          console.warn('[db] Erreur lors de la migration de l\'ancienne base:', migErr);
        }
      }
    }

    fs.accessSync(dataDir, fs.constants.W_OK);
    return targetDbPath;
  } catch (err) {
    const fallbackDir = path.join(os.homedir(), '.letoile-invoicing', 'data');
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    console.warn(`[db] process.cwd()/data non accessible en écriture, fallback sur: ${fallbackDir}`);
    return path.resolve(path.join(fallbackDir, dbFileName));
  }
}

const globalForDb = globalThis as unknown as {
  db: Database.Database;
  statementCache: Map<string, any>;
  isClosing: boolean;
};

const dbPath = resolveDatabasePath();
const db = globalForDb.db || new Database(dbPath, { timeout: 5000 });
if (!globalForDb.db) {
  globalForDb.db = db;
}

// [QA-Phase 2] Configuration de la base de données pour la concurrence et la robustesse
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Clôture gracieuse de la base de données (WAL Checkpoint & Close)
const closeDb = () => {
  if (globalForDb.isClosing) return;
  globalForDb.isClosing = true;
  try {
    if (db && db.open) {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (e) {
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

// Cache global pour les requêtes préparées (Statement Cache)
const statementCache = globalForDb.statementCache || new Map<string, ReturnType<typeof db.prepare>>();
if (process.env.NODE_ENV !== 'production') {
  globalForDb.statementCache = statementCache;
}

/**
 * Récupère une requête préparée mise en cache ou la compile si elle n'existe pas.
 * Évite de recompiler le SQL à chaque requête HTTP Next.js.
 */
export function prepareCached(sql: string) {
  let stmt = statementCache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    statementCache.set(sql, stmt);
  }
  return stmt;
}

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    companyName TEXT,
    legalForm TEXT,
    nif TEXT,
    rccm TEXT,
    address TEXT,
    email TEXT,
    phone TEXT,
    bankName TEXT,
    bankAgency TEXT,
    accountNumber TEXT,
    swiftCode TEXT,
    iban TEXT,
    tvaRate REAL,
    tpsRate REAL DEFAULT 9.5,
    cssRate REAL,
    sessionTimeout INTEGER,
    invoicePrefix TEXT,
    quotePrefix TEXT,
    companyCode TEXT,
    mentionsLegales TEXT,
    logo TEXT
  );

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    status TEXT DEFAULT 'active',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME,
    created_by TEXT
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    number TEXT UNIQUE NOT NULL,
    clientId TEXT NOT NULL,
    clientName TEXT,
    clientEmail TEXT,
    date TEXT NOT NULL,
    subtotal REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    taxBase REAL DEFAULT 0,
    tpsAmount REAL DEFAULT 0,
    tvaAmount REAL DEFAULT 0,
    cssAmount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    status TEXT DEFAULT 'EN_ATTENTE', -- EN_ATTENTE, CONVERTI
    notes TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME,
    created_by TEXT,
    FOREIGN KEY (clientId) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS quote_items (
    id TEXT PRIMARY KEY,
    quoteId TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity REAL NOT NULL,
    unitPrice REAL NOT NULL,
    total REAL NOT NULL,
    FOREIGN KEY (quoteId) REFERENCES quotes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    number TEXT UNIQUE NOT NULL,
    quoteId TEXT, -- Link to quote if converted
    clientId TEXT NOT NULL,
    clientName TEXT,
    clientEmail TEXT,
    date TEXT NOT NULL,
    subtotal REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    taxBase REAL DEFAULT 0,
    tpsAmount REAL DEFAULT 0,
    tvaAmount REAL DEFAULT 0,
    cssAmount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    status TEXT DEFAULT 'UNPAID', -- draft, UNPAID, PARTIALLY_PAID, PAID, overdue, cancelled
    notes TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME,
    created_by TEXT,
    FOREIGN KEY (clientId) REFERENCES clients(id),
    FOREIGN KEY (quoteId) REFERENCES quotes(id)
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoiceId TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity REAL NOT NULL,
    unitPrice REAL NOT NULL,
    total REAL NOT NULL,
    FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    invoiceId TEXT NOT NULL,
    amount REAL NOT NULL,
    paymentMethod TEXT NOT NULL, -- airtel, moov, virement, cash
    date TEXT NOT NULL,
    reference TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME,
    created_by TEXT,
    FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sequences (
    name TEXT PRIMARY KEY,
    current_value INTEGER DEFAULT 0,
    last_year INTEGER
  );

  INSERT OR IGNORE INTO sequences (name, current_value, last_year) VALUES ('quote', 0, strftime('%Y', 'now'));
  INSERT OR IGNORE INTO sequences (name, current_value, last_year) VALUES ('invoice', 0, strftime('%Y', 'now'));

  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unitPrice REAL DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME,
    created_by TEXT
  );

  -- New User Table Schema (v4.0)
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL, -- used as email in logic
    email TEXT UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'user')) NOT NULL DEFAULT 'user',
    is_active INTEGER NOT NULL DEFAULT 1,
    force_password_change INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME,
    created_by TEXT,
    phone TEXT,
    deletedAt DATETIME
  );

  CREATE TABLE IF NOT EXISTS credit_notes (
    id TEXT PRIMARY KEY,
    number TEXT UNIQUE NOT NULL,
    invoiceId TEXT NOT NULL,
    clientId TEXT NOT NULL,
    clientName TEXT,
    date TEXT NOT NULL,
    reason TEXT,
    subtotal REAL DEFAULT 0,
    taxBase REAL DEFAULT 0,
    tpsAmount REAL DEFAULT 0,
    tvaAmount REAL DEFAULT 0,
    cssAmount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    status TEXT DEFAULT 'open', -- open, closed
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    deletedAt DATETIME,
    FOREIGN KEY (invoiceId) REFERENCES invoices(id),
    FOREIGN KEY (clientId) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS credit_note_items (
    id TEXT PRIMARY KEY,
    creditNoteId TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity REAL NOT NULL,
    unitPrice REAL NOT NULL,
    total REAL NOT NULL,
    FOREIGN KEY (creditNoteId) REFERENCES credit_notes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    userId TEXT,
    userName TEXT,
    action TEXT NOT NULL,
    entityType TEXT NOT NULL, -- quote, invoice, client, etc.
    entityId TEXT,
    details TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

`);

// --- Migrations begin ---
// Note: Indices are created after migrations to prevent "no such column" errors
// when the table already exists but the column hasn't been added by migration yet.

// MIGRATION LOGIC FOR USERS (v3 to v4)
try {
  const usersColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;

  if (!usersColumns.some(c => c.name === 'is_active')) {
    db.prepare("ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1").run();
  }
  if (!usersColumns.some(c => c.name === 'force_password_change')) {
    db.prepare("ALTER TABLE users ADD COLUMN force_password_change INTEGER NOT NULL DEFAULT 0").run();
  }
  if (!usersColumns.some(c => c.name === 'last_login_at')) {
    db.prepare("ALTER TABLE users ADD COLUMN last_login_at DATETIME").run();
  }
  if (!usersColumns.some(c => c.name === 'created_by')) {
    db.prepare("ALTER TABLE users ADD COLUMN created_by TEXT").run();
  }
  if (!usersColumns.some(c => c.name === 'email')) {
    db.prepare("ALTER TABLE users ADD COLUMN email TEXT").run();
    // Pre-populate email with username
    db.prepare("UPDATE users SET email = username WHERE email IS NULL").run();
  }
  if (!usersColumns.some(c => c.name === 'created_at')) {
    db.prepare("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP").run();
  }
  if (!usersColumns.some(c => c.name === 'phone')) {
    db.prepare("ALTER TABLE users ADD COLUMN phone TEXT").run();
  }
  if (!usersColumns.some(c => c.name === 'deletedAt')) {
    db.prepare("ALTER TABLE users ADD COLUMN deletedAt DATETIME").run();
  }
} catch (e) {
  console.error("Migration error on users table:", e);
}

// Ensure other missing columns from previous migrations
try {
  const quotesColumns = db.prepare("PRAGMA table_info(quotes)").all() as Array<{ name: string }>;
  if (!quotesColumns.some(c => c.name === 'created_by')) {
    db.prepare("ALTER TABLE quotes ADD COLUMN created_by TEXT").run();
  }

  const invoicesColumns = db.prepare("PRAGMA table_info(invoices)").all() as Array<{ name: string }>;
  if (!invoicesColumns.some(c => c.name === 'created_by')) {
    db.prepare("ALTER TABLE invoices ADD COLUMN created_by TEXT").run();
  }

<<<<<<< HEAD
  const servicesColumns = db.prepare("PRAGMA table_info(services)").all() as Array<{ name: string }>;
  if (!servicesColumns.some(c => c.name === 'created_by')) {
    db.prepare("ALTER TABLE services ADD COLUMN created_by TEXT").run();
  }

=======
  if (!invoicesColumns.some(c => c.name === 'dueDate')) {
    db.prepare("ALTER TABLE invoices ADD COLUMN dueDate TEXT").run();
    db.prepare("UPDATE invoices SET dueDate = date(date, '+30 days') WHERE dueDate IS NULL").run();
  }

  // Sanitization of Invoice Statuses
  db.prepare("UPDATE invoices SET status = 'UNPAID' WHERE status IN ('pending', 'sent', 'open')").run();
  db.prepare("UPDATE invoices SET status = 'PAID' WHERE status = 'paid'").run();
  db.prepare("UPDATE invoices SET status = 'PARTIALLY_PAID' WHERE status IN ('partially_paid', 'partial')").run();

>>>>>>> 6cda2b22dcd445d3f0421bc8bec2c1c70a15927d
  // TPS Migrations
  const settingsColumns = db.prepare("PRAGMA table_info(settings)").all() as Array<{ name: string }>;
  if (!settingsColumns.some(c => c.name === 'tpsRate')) {
    db.prepare("ALTER TABLE settings ADD COLUMN tpsRate REAL DEFAULT 9.5").run();
  }

  if (!quotesColumns.some(c => c.name === 'tpsAmount')) {
    db.prepare("ALTER TABLE quotes ADD COLUMN tpsAmount REAL DEFAULT 0").run();
  }

  if (!invoicesColumns.some(c => c.name === 'tpsAmount')) {
    db.prepare("ALTER TABLE invoices ADD COLUMN tpsAmount REAL DEFAULT 0").run();
  }

  const cnColumns = db.prepare("PRAGMA table_info(credit_notes)").all() as Array<{ name: string }>;
  if (!cnColumns.some(c => c.name === 'tpsAmount')) {
    db.prepare("ALTER TABLE credit_notes ADD COLUMN tpsAmount REAL DEFAULT 0").run();
  }
  if (!cnColumns.some(c => c.name === 'created_by')) {
    db.prepare("ALTER TABLE credit_notes ADD COLUMN created_by TEXT").run();
  }

  // Soft Delete Migrations for Phase 3
  const clientsColumns = db.prepare("PRAGMA table_info(clients)").all() as Array<{ name: string }>;
  if (!clientsColumns.some(c => c.name === 'deletedAt')) {
    db.prepare("ALTER TABLE clients ADD COLUMN deletedAt DATETIME").run();
  }
  if (!clientsColumns.some(c => c.name === 'created_by')) {
    db.prepare("ALTER TABLE clients ADD COLUMN created_by TEXT").run();
  }

  if (!servicesColumns.some(c => c.name === 'deletedAt')) {
    db.prepare("ALTER TABLE services ADD COLUMN deletedAt DATETIME").run();
  }

  if (!cnColumns.some(c => c.name === 'deletedAt')) {
    db.prepare("ALTER TABLE credit_notes ADD COLUMN deletedAt DATETIME").run();
  }

  const paymentsColumns = db.prepare("PRAGMA table_info(payments)").all() as Array<{ name: string }>;
  if (!paymentsColumns.some(c => c.name === 'deletedAt')) {
    db.prepare("ALTER TABLE payments ADD COLUMN deletedAt DATETIME").run();
  }
  if (!paymentsColumns.some(c => c.name === 'created_by')) {
    db.prepare("ALTER TABLE payments ADD COLUMN created_by TEXT").run();
  }
} catch (e) {
  console.error("Migration error:", e);
}

// Create Indices AFTER all columns are ensured to exist
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_clients_deletedAt ON clients(deletedAt);
  CREATE INDEX IF NOT EXISTS idx_quotes_deletedAt ON quotes(deletedAt);
  CREATE INDEX IF NOT EXISTS idx_quotes_clientId ON quotes(clientId);
  CREATE INDEX IF NOT EXISTS idx_invoices_deletedAt ON invoices(deletedAt);
  CREATE INDEX IF NOT EXISTS idx_invoices_clientId ON invoices(clientId);
  CREATE INDEX IF NOT EXISTS idx_invoices_quoteId ON invoices(quoteId);
  CREATE INDEX IF NOT EXISTS idx_payments_deletedAt ON payments(deletedAt);
  CREATE INDEX IF NOT EXISTS idx_payments_invoiceId ON payments(invoiceId);
  CREATE INDEX IF NOT EXISTS idx_payments_created_by ON payments(created_by);
  CREATE INDEX IF NOT EXISTS idx_credit_notes_deletedAt ON credit_notes(deletedAt);
  CREATE INDEX IF NOT EXISTS idx_credit_notes_invoiceId ON credit_notes(invoiceId);
  CREATE INDEX IF NOT EXISTS idx_credit_notes_clientId ON credit_notes(clientId);
  CREATE INDEX IF NOT EXISTS idx_services_deletedAt ON services(deletedAt);
  CREATE INDEX IF NOT EXISTS idx_quote_items_quoteId ON quote_items(quoteId);
  CREATE INDEX IF NOT EXISTS idx_invoice_items_invoiceId ON invoice_items(invoiceId);
  CREATE INDEX IF NOT EXISTS idx_credit_note_items_creditNoteId ON credit_note_items(creditNoteId);
  
  -- Users optimizations
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_deletedAt ON users(deletedAt);

  -- High Performance Indices (Phase 2 Architect)
  CREATE INDEX IF NOT EXISTS idx_invoices_status_deleted ON invoices(status, deletedAt);
  CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by);
  CREATE INDEX IF NOT EXISTS idx_quotes_status_deleted ON quotes(status, deletedAt);
  CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON quotes(created_by);
  CREATE INDEX IF NOT EXISTS idx_payments_invoice_deleted ON payments(invoiceId, deletedAt);
  CREATE INDEX IF NOT EXISTS idx_clients_deleted ON clients(deletedAt);
`);

// Phase 1: Backfilling & Orphans Cleanup
try {
  db.prepare("UPDATE payments SET created_by = (SELECT created_by FROM invoices WHERE id = payments.invoiceId) WHERE created_by IS NULL").run();

  const firstAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as { id: string } | undefined;
  if (firstAdmin?.id) {
    db.prepare("UPDATE clients SET created_by = ? WHERE created_by IS NULL").run(firstAdmin.id);
    db.prepare("UPDATE services SET created_by = ? WHERE created_by IS NULL").run(firstAdmin.id);
    db.prepare("UPDATE quotes SET created_by = ? WHERE created_by IS NULL").run(firstAdmin.id);
    db.prepare("UPDATE invoices SET created_by = ? WHERE created_by IS NULL").run(firstAdmin.id);
  }
} catch (e) {
  console.error("Backfilling & Orphans Cleanup error:", e);
}


// [QA-Phase 2] Proxy transparent pour intercepter tous les appels db.prepare
// et utiliser automatiquement le Statement Cache global.
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
  }
});

export default dbProxy;
