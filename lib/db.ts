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
    cssRate REAL,
    defaultDueDateDays INTEGER,
    defaultQuoteValidity INTEGER,
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
    tvaAmount REAL DEFAULT 0,
    cssAmount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    status TEXT DEFAULT 'draft', -- draft, sent, invoiced, rejected
    notes TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    tvaAmount REAL DEFAULT 0,
    cssAmount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    status TEXT DEFAULT 'pending', -- draft, pending, paid, overdue, cancelled
    notes TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
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

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Hashed
    name TEXT,
    role TEXT DEFAULT 'admin',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
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
    tvaAmount REAL DEFAULT 0,
    cssAmount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    status TEXT DEFAULT 'open', -- open, closed
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
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

// Migrate settings table to add missing columns if upgrading database schema
try {
  const settingsColumns = db.prepare("PRAGMA table_info(settings)").all() as Array<{ name: string }>;
  const requiredColumns = [
    { name: 'logo', type: 'TEXT' },
    { name: 'companyCode', type: 'TEXT', default: 'GM' },
    { name: 'legalForm', type: 'TEXT', default: 'SARL' },
    { name: 'bankAgency', type: 'TEXT' },
    { name: 'accountNumber', type: 'TEXT' },
    { name: 'swiftCode', type: 'TEXT' },
    { name: 'defaultQuoteValidity', type: 'INTEGER', default: '30' },
    { name: 'sessionTimeout', type: 'INTEGER', default: '30' }
  ];

  requiredColumns.forEach(col => {
    const exists = settingsColumns.some(c => c.name === col.name);
    if (!exists) {
      let query = `ALTER TABLE settings ADD COLUMN ${col.name} ${col.type}`;
      if (col.default) query += ` DEFAULT '${col.default}'`;
      db.prepare(query).run();
      console.log(`✓ Database Migration: Added missing '${col.name}' column to 'settings' table.`);
    }
  });
} catch (migrationError) {
  console.error("❌ Database Migration Error during settings migration:", migrationError);
}

// Migrate quotes table to add missing deletedAt column if upgrading database schema for soft deletes
try {
  const quotesColumns = db.prepare("PRAGMA table_info(quotes)").all() as Array<{ name: string }>;
  const hasDeletedAt = quotesColumns.some(col => col.name === 'deletedAt');
  if (!hasDeletedAt) {
    db.prepare("ALTER TABLE quotes ADD COLUMN deletedAt TEXT").run();
    console.log("✓ Database Migration: Added missing 'deletedAt' column to 'quotes' table successfully.");
  }
} catch (migrationError) {
  console.error("❌ Database Migration Error adding 'deletedAt' column to quotes:", migrationError);
}

// Migrate invoices table to add missing deletedAt column if upgrading database schema for soft deletes
try {
  const invoicesColumns = db.prepare("PRAGMA table_info(invoices)").all() as Array<{ name: string }>;
  const hasDeletedAt = invoicesColumns.some(col => col.name === 'deletedAt');
  if (!hasDeletedAt) {
    db.prepare("ALTER TABLE invoices ADD COLUMN deletedAt TEXT").run();
    console.log("✓ Database Migration: Added missing 'deletedAt' column to 'invoices' table successfully.");
  }
} catch (migrationError) {
  console.error("❌ Database Migration Error adding 'deletedAt' column to invoices:", migrationError);
}

// Migrate sequences table to add missing last_year column
try {
  const sequencesColumns = db.prepare("PRAGMA table_info(sequences)").all() as Array<{ name: string }>;
  const hasLastYear = sequencesColumns.some(col => col.name === 'last_year');
  if (!hasLastYear) {
    db.prepare("ALTER TABLE sequences ADD COLUMN last_year INTEGER").run();
    db.prepare("UPDATE sequences SET last_year = strftime('%Y', 'now')").run();
    console.log("✓ Database Migration: Added missing 'last_year' column to 'sequences' table successfully.");
  }
} catch (migrationError) {
  console.error("❌ Database Migration Error adding 'last_year' column to sequences:", migrationError);
}

// Insert default settings if not exists
const row = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
if (row.count === 0) {
  db.prepare(`
    INSERT INTO settings (
      id, companyName, legalForm, nif, rccm, address, email, phone, mentionsLegales,
      bankName, bankAgency, accountNumber, swiftCode, iban,
      tvaRate, cssRate, defaultDueDateDays, defaultQuoteValidity, sessionTimeout,
      invoicePrefix, quotePrefix, companyCode
    ) VALUES (
      1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
    1,
    30,
    30,
    30,
    "FAC",
    "DEV",
    "GM"
  );
}

export default db;
