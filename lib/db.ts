import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    companyName TEXT,
    nif TEXT,
    rccm TEXT,
    address TEXT,
    email TEXT,
    phone TEXT,
    bankName TEXT,
    iban TEXT,
    tvaRate REAL,
    cssRate REAL,
    defaultDueDateDays INTEGER,
    invoicePrefix TEXT,
    quotePrefix TEXT,
    mentionsLegales TEXT
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

  CREATE TABLE IF NOT EXISTS sequences (
    name TEXT PRIMARY KEY,
    current_value INTEGER DEFAULT 0
  );

  INSERT OR IGNORE INTO sequences (name, current_value) VALUES ('quote', 0);
  INSERT OR IGNORE INTO sequences (name, current_value) VALUES ('invoice', 0);
`);

// Insert default settings if not exists
const row = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
if (row.count === 0) {
  db.prepare(`
    INSERT INTO settings (
      id, companyName, nif, rccm, address, email, phone, bankName, iban,
      tvaRate, cssRate, defaultDueDateDays, invoicePrefix, quotePrefix
    ) VALUES (
      1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    "L'Etoile SARL",
    "XXXXXXXXXX",
    "GA-LBV-XX-XXXX-XXXX",
    "123 Boulevard Triomphal, Libreville, Gabon",
    "facturation@letoile.ga",
    "+241 01 76 XX XX",
    "BGFI Bank",
    "GAXX XXXX XXXX XXXX XXXX",
    18,
    1,
    30,
    "FAC",
    "DEV"
  );
}

export default db;
