import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

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
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    number TEXT UNIQUE NOT NULL,
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
    status TEXT DEFAULT 'draft', -- draft, sent, invoiced, rejected
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
    dueDate TEXT,
    subtotal REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    taxBase REAL DEFAULT 0,
    tpsAmount REAL DEFAULT 0,
    tvaAmount REAL DEFAULT 0,
    cssAmount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    status TEXT DEFAULT 'pending', -- draft, pending, paid, overdue, cancelled
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
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
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
    created_by TEXT
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
} catch (e) {
  console.error("Migration error:", e);
}

// Insert default settings
const row = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
if (row.count === 0) {
  db.prepare(`
    INSERT INTO settings (
      id, companyName, legalForm, nif, rccm, address, email, phone, mentionsLegales,
      bankName, bankAgency, accountNumber, swiftCode, iban,
      tvaRate, tpsRate, cssRate, sessionTimeout, invoicePrefix, quotePrefix, companyCode
    ) VALUES (
      1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    "Global Maintenance",
    "SARL",
    "XXXXXXXXXX",
    "GA-LBV-XX-XXXX-XXXX",
    "123 Boulevard Triomphal, Libreville, Gabon",
    "facturation@globalm.ga",
    "+241 01 76 XX XX",
    "Merci de votre confiance.",
    "BGFI Bank",
    "Libreville",
    "XXXXXXXXXX",
    "BGFIGAXX",
    "GAXX XXXX XXXX XXXX XXXX",
    18,
    9.5,
    1,
    30,
    "FAC",
    "DEV",
    "GM"
  );
}

export default db;
