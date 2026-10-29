import Database from 'better-sqlite3';
import { Migration } from './types';

export const migration0001: Migration = {
  version: 1,
  name: 'initial_schema',
  up: (db: Database.Database) => {
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
        nif TEXT,
        rccm TEXT,
        status TEXT DEFAULT 'active',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        deletedAt DATETIME,
        created_by TEXT,
        tenant_id TEXT
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
        status TEXT DEFAULT 'EN_ATTENTE',
        notes TEXT,
        subject TEXT,
        validUntil TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        deletedAt DATETIME,
        created_by TEXT,
        tenant_id TEXT,
        FOREIGN KEY (clientId) REFERENCES clients(id)
      );

      CREATE TABLE IF NOT EXISTS quote_items (
        id TEXT PRIMARY KEY,
        quoteId TEXT NOT NULL,
        description TEXT NOT NULL,
        quantity REAL NOT NULL,
        unitPrice REAL NOT NULL,
        total REAL NOT NULL,
        tenant_id TEXT,
        deletedAt DATETIME,
        FOREIGN KEY (quoteId) REFERENCES quotes(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        number TEXT UNIQUE NOT NULL,
        quoteId TEXT,
        clientId TEXT NOT NULL,
        clientName TEXT,
        clientEmail TEXT,
        date TEXT NOT NULL,
        dueDate TEXT,
        subtotal REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        taxBase REAL DEFAULT 0,
        tpsAmount REAL DEFAULT 0,
        tvaAmount REAL DEFAULT 0,
        cssAmount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        status TEXT DEFAULT 'UNPAID',
        notes TEXT,
        subject TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        deletedAt DATETIME,
        created_by TEXT,
        tenant_id TEXT,
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
        tenant_id TEXT,
        deletedAt DATETIME,
        FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        invoiceId TEXT NOT NULL,
        amount REAL NOT NULL,
        paymentMethod TEXT NOT NULL,
        date TEXT NOT NULL,
        reference TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        deletedAt DATETIME,
        created_by TEXT,
        tenant_id TEXT,
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
        created_by TEXT,
        tenant_id TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
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
        deletedAt DATETIME,
        tenant_id TEXT
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
        status TEXT DEFAULT 'open',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        deletedAt DATETIME,
        tenant_id TEXT,
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
        tenant_id TEXT,
        deletedAt DATETIME,
        FOREIGN KEY (creditNoteId) REFERENCES credit_notes(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        userId TEXT,
        userName TEXT,
        action TEXT NOT NULL,
        entityType TEXT NOT NULL,
        entityId TEXT,
        details TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        tenant_id TEXT
      );

      CREATE TABLE IF NOT EXISTS hub_cache (
        kind TEXT NOT NULL,
        key TEXT NOT NULL,
        payload TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        PRIMARY KEY (kind, key)
      );

      CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS sync_tombstones (
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        deleted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        PRIMARY KEY (table_name, record_id)
      );

      CREATE TABLE IF NOT EXISTS pending_cloud_members (
        email TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE TABLE IF NOT EXISTS sync_failures (
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        error TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 1,
        last_attempt_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        PRIMARY KEY (table_name, record_id)
      );
    `);

    ensureLegacyColumns(db);
  },
};

/**
 * Rattrape de manière idempotente les colonnes ajoutées au fil du temps sur une base SQLite
 * préexistante (où CREATE TABLE IF NOT EXISTS n'ajoute pas les nouvelles colonnes).
 */
export function ensureLegacyColumns(db: Database.Database): void {
  const columnsByTable: Record<string, Array<[string, string]>> = {
    settings: [
      ['companyName', 'TEXT'],
      ['legalForm', 'TEXT'],
      ['nif', 'TEXT'],
      ['rccm', 'TEXT'],
      ['address', 'TEXT'],
      ['email', 'TEXT'],
      ['phone', 'TEXT'],
      ['bankName', 'TEXT'],
      ['bankAgency', 'TEXT'],
      ['accountNumber', 'TEXT'],
      ['swiftCode', 'TEXT'],
      ['iban', 'TEXT'],
      ['tvaRate', 'REAL'],
      ['tpsRate', 'REAL DEFAULT 9.5'],
      ['cssRate', 'REAL'],
      ['sessionTimeout', 'INTEGER'],
      ['invoicePrefix', 'TEXT'],
      ['quotePrefix', 'TEXT'],
      ['companyCode', 'TEXT'],
      ['mentionsLegales', 'TEXT'],
      ['logo', 'TEXT'],
    ],
    clients: [
      ['email', 'TEXT'],
      ['phone', 'TEXT'],
      ['address', 'TEXT'],
      ['nif', 'TEXT'],
      ['rccm', 'TEXT'],
      ['status', "TEXT DEFAULT 'active'"],
      ['createdAt', 'DATETIME'],
      ['deletedAt', 'DATETIME'],
      ['created_by', 'TEXT'],
      ['tenant_id', 'TEXT'],
    ],
    services: [
      ['description', 'TEXT'],
      ['category', 'TEXT'],
      ['unitPrice', 'REAL DEFAULT 0'],
      ['createdAt', 'DATETIME'],
      ['deletedAt', 'DATETIME'],
      ['created_by', 'TEXT'],
      ['tenant_id', 'TEXT'],
    ],
    quotes: [
      ['clientName', 'TEXT'],
      ['clientEmail', 'TEXT'],
      ['dueDate', 'TEXT'],
      ['subtotal', 'REAL DEFAULT 0'],
      ['discount', 'REAL DEFAULT 0'],
      ['taxBase', 'REAL DEFAULT 0'],
      ['tpsAmount', 'REAL DEFAULT 0'],
      ['tvaAmount', 'REAL DEFAULT 0'],
      ['cssAmount', 'REAL DEFAULT 0'],
      ['total', 'REAL DEFAULT 0'],
      ['status', "TEXT DEFAULT 'EN_ATTENTE'"],
      ['notes', 'TEXT'],
      ['subject', 'TEXT'],
      ['validUntil', 'TEXT'],
      ['createdAt', 'DATETIME'],
      ['deletedAt', 'DATETIME'],
      ['created_by', 'TEXT'],
      ['tenant_id', 'TEXT'],
    ],
    quote_items: [
      ['tenant_id', 'TEXT'],
      ['deletedAt', 'DATETIME'],
    ],
    invoices: [
      ['quoteId', 'TEXT'],
      ['clientName', 'TEXT'],
      ['clientEmail', 'TEXT'],
      ['dueDate', 'TEXT'],
      ['subtotal', 'REAL DEFAULT 0'],
      ['discount', 'REAL DEFAULT 0'],
      ['taxBase', 'REAL DEFAULT 0'],
      ['tpsAmount', 'REAL DEFAULT 0'],
      ['tvaAmount', 'REAL DEFAULT 0'],
      ['cssAmount', 'REAL DEFAULT 0'],
      ['total', 'REAL DEFAULT 0'],
      ['status', "TEXT DEFAULT 'UNPAID'"],
      ['notes', 'TEXT'],
      ['subject', 'TEXT'],
      ['validUntil', 'TEXT'],
      ['createdAt', 'DATETIME'],
      ['deletedAt', 'DATETIME'],
      ['created_by', 'TEXT'],
      ['tenant_id', 'TEXT'],
    ],
    invoice_items: [
      ['tenant_id', 'TEXT'],
      ['deletedAt', 'DATETIME'],
    ],
    payments: [
      ['paymentMethod', "TEXT DEFAULT 'VIREMENT'"],
      ['reference', 'TEXT'],
      ['createdAt', 'DATETIME'],
      ['deletedAt', 'DATETIME'],
      ['created_by', 'TEXT'],
      ['tenant_id', 'TEXT'],
    ],
    users: [
      ['email', 'TEXT'],
      ['is_active', 'INTEGER NOT NULL DEFAULT 1'],
      ['force_password_change', 'INTEGER NOT NULL DEFAULT 0'],
      ['created_at', 'DATETIME'],
      ['last_login_at', 'DATETIME'],
      ['created_by', 'TEXT'],
      ['phone', 'TEXT'],
      ['deletedAt', 'DATETIME'],
      ['tenant_id', 'TEXT'],
    ],
    credit_notes: [
      ['clientName', 'TEXT'],
      ['reason', 'TEXT'],
      ['subtotal', 'REAL DEFAULT 0'],
      ['taxBase', 'REAL DEFAULT 0'],
      ['tpsAmount', 'REAL DEFAULT 0'],
      ['tvaAmount', 'REAL DEFAULT 0'],
      ['cssAmount', 'REAL DEFAULT 0'],
      ['total', 'REAL DEFAULT 0'],
      ['status', "TEXT DEFAULT 'open'"],
      ['createdAt', 'DATETIME'],
      ['created_by', 'TEXT'],
      ['deletedAt', 'DATETIME'],
      ['tenant_id', 'TEXT'],
    ],
    credit_note_items: [
      ['tenant_id', 'TEXT'],
      ['deletedAt', 'DATETIME'],
    ],
    audit_logs: [
      ['userId', 'TEXT'],
      ['userName', 'TEXT'],
      ['entityType', 'TEXT'],
      ['entityId', 'TEXT'],
      ['details', 'TEXT'],
      ['createdAt', 'DATETIME'],
      ['tenant_id', 'TEXT'],
    ],
  };

  for (const [table, cols] of Object.entries(columnsByTable)) {
    const existing = new Set(
      (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name)
    );
    if (existing.size === 0) continue;
    for (const [colName, colDef] of cols) {
      if (!existing.has(colName)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${colName} ${colDef}`);
      }
    }
  }
}
