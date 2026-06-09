import Database from 'better-sqlite3';
import crypto from 'crypto';

// ============================================================================
// DATABASE TYPES FOR TESTS
// ============================================================================

interface DbUser {
  id: string;
  username: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'user';
  is_active: number;
  force_password_change: number;
  created_at: string;
  last_login_at: string | null;
  created_by: string | null;
  phone: string | null;
}

interface DbClient {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: string;
  createdAt: string;
  deletedAt: string | null;
}

interface DbInvoice {
  id: string;
  number: string;
  quoteId: string | null;
  clientId: string;
  clientName: string;
  clientEmail: string;
  date: string;
  dueDate: string;
  subtotal: number;
  discount: number;
  taxBase: number;
  tpsAmount: number;
  tvaAmount: number;
  cssAmount: number;
  total: number;
  status: string;
  notes: string | null;
  createdAt: string;
  deletedAt: string | null;
  created_by: string | null;
}

interface DbPayment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  date: string;
  reference: string | null;
  createdAt: string;
  deletedAt: string | null;
}

interface DbTotal {
  total: number;
}

// ============================================================================
// IN-MEMORY DATABASE SETUP
// ============================================================================

let testDb: Database.Database | null = null;

/**
 * Create an in-memory SQLite database for testing
 * @returns {Database.Database} The test database instance
 */
export function createTestDatabase(): Database.Database {
  if (testDb) {
    return testDb;
  }

  testDb = new Database(':memory:');
  testDb.pragma('foreign_keys = ON');

  // Initialize schema
  testDb.exec(`
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
      phone TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      status TEXT DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      deletedAt DATETIME
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
      status TEXT DEFAULT 'draft',
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
      quantity REAL DEFAULT 1,
      unitPrice REAL DEFAULT 0,
      total REAL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
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
      status TEXT DEFAULT 'pending',
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
      paymentMethod TEXT NOT NULL,
      date TEXT NOT NULL,
      reference TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      deletedAt DATETIME,
      FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sequences (
      name TEXT PRIMARY KEY,
      current_value INTEGER DEFAULT 0,
      last_year INTEGER
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      unitPrice REAL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
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
      status TEXT DEFAULT 'open',
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
      entityType TEXT NOT NULL,
      entityId TEXT,
      details TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO sequences (name, current_value, last_year) VALUES ('quote', 0, strftime('%Y', 'now'));
    INSERT OR IGNORE INTO sequences (name, current_value, last_year) VALUES ('invoice', 0, strftime('%Y', 'now'));

    CREATE INDEX IF NOT EXISTS idx_clients_deletedAt ON clients(deletedAt);
    CREATE INDEX IF NOT EXISTS idx_quotes_deletedAt ON quotes(deletedAt);
    CREATE INDEX IF NOT EXISTS idx_quotes_clientId ON quotes(clientId);
    CREATE INDEX IF NOT EXISTS idx_invoices_deletedAt ON invoices(deletedAt);
    CREATE INDEX IF NOT EXISTS idx_invoices_clientId ON invoices(clientId);
    CREATE INDEX IF NOT EXISTS idx_invoices_quoteId ON invoices(quoteId);
    CREATE INDEX IF NOT EXISTS idx_payments_deletedAt ON payments(deletedAt);
    CREATE INDEX IF NOT EXISTS idx_payments_invoiceId ON payments(invoiceId);
    CREATE INDEX IF NOT EXISTS idx_credit_notes_deletedAt ON credit_notes(deletedAt);
    CREATE INDEX IF NOT EXISTS idx_credit_notes_invoiceId ON credit_notes(invoiceId);
    CREATE INDEX IF NOT EXISTS idx_credit_notes_clientId ON credit_notes(clientId);
    CREATE INDEX IF NOT EXISTS idx_services_deletedAt ON services(deletedAt);
    CREATE INDEX IF NOT EXISTS idx_quote_items_quoteId ON quote_items(quoteId);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoiceId ON invoice_items(invoiceId);
    CREATE INDEX IF NOT EXISTS idx_credit_note_items_creditNoteId ON credit_note_items(creditNoteId);
  `);

  return testDb;
}

/**
 * Get the test database instance
 * @returns {Database.Database} The test database instance
 */
export function getTestDatabase(): Database.Database {
  if (!testDb) {
    return createTestDatabase();
  }
  return testDb;
}

/**
 * Seed test data into the database
 * Creates: 1 admin user, 1 regular user, 1 test client, 1 test invoice
 */
export function seedTestData(db?: Database.Database): void {
  if (!db) db = getTestDatabase();

  // Insert admin user (using INSERT OR REPLACE to handle duplicates)
  const adminId = crypto.randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO users (id, username, email, password, name, role, is_active, force_password_change, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    adminId,
    'admin',
    'admin@test.com',
    '$2b$10$hashedpassword',
    'Admin User',
    'admin',
    1,
    0,
    new Date().toISOString()
  );

  // Insert regular user (using INSERT OR REPLACE to handle duplicates)
  const userId = crypto.randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO users (id, username, email, password, name, role, is_active, force_password_change, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    'user',
    'user@test.com',
    '$2b$10$hashedpassword',
    'Regular User',
    'user',
    1,
    0,
    new Date().toISOString()
  );

  // Insert test client (using INSERT OR REPLACE to handle duplicates)
  const clientId = 'client-1';
  db.prepare(`
    INSERT OR REPLACE INTO clients (id, name, email, phone, address, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    clientId,
    'Test Client',
    'client@test.com',
    '+241 01 23 45 67',
    '123 Test Street, Libreville',
    'active',
    new Date().toISOString()
  );

  // Insert test invoice (using INSERT OR REPLACE to handle duplicates)
  const invoiceId = crypto.randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    invoiceId,
    'FAC-001/GM/2026',
    clientId,
    'Test Client',
    'client@test.com',
    '2026-01-01',
    '2026-01-15',
    10000,
    0,
    10000,
    950,
    1800,
    100,
    11850,
    'UNPAID',
    new Date().toISOString()
  );

  // Insert sequence values (using INSERT OR REPLACE to handle duplicates)
  db.prepare("INSERT OR REPLACE INTO sequences (name, current_value, last_year) VALUES ('invoice', 1, 2026)").run();
  db.prepare("INSERT OR REPLACE INTO sequences (name, current_value, last_year) VALUES ('quote', 0, 2026)").run();

  // Insert default settings
  db.prepare(`
    INSERT OR REPLACE INTO settings (
      id, companyName, legalForm, nif, rccm, address, email, phone, mentionsLegales,
      bankName, bankAgency, accountNumber, swiftCode, iban,
      tvaRate, tpsRate, cssRate, sessionTimeout,
      invoicePrefix, quotePrefix, companyCode
    ) VALUES (
      1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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

/**
 * Clean up test data from the database
 * Deletes in correct order to respect foreign key constraints
 */
export function cleanupTestDatabase(): void {
  const db = getTestDatabase();
  // Delete child tables first
  db.prepare('DELETE FROM audit_logs').run();
  db.prepare('DELETE FROM credit_note_items').run();
  db.prepare('DELETE FROM credit_notes').run();
  db.prepare('DELETE FROM payments').run();
  db.prepare('DELETE FROM invoice_items').run();
  db.prepare('DELETE FROM invoices').run();
  db.prepare('DELETE FROM quote_items').run();
  db.prepare('DELETE FROM quotes').run();
  db.prepare('DELETE FROM services').run();
  // Then delete parent tables
  db.prepare('DELETE FROM clients').run();
  db.prepare('DELETE FROM users').run();
  db.prepare('DELETE FROM sequences').run();
}

/**
 * Close the test database connection
 */
export function closeTestDatabase(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}

/**
 * Create a mock authenticated session for RBAC testing
 * @param {string} role - The role to assign ('admin' or 'user')
 * @returns {{ userId: string; role: string; name: string; username: string }} Mock session object
 */
export function createAuthenticatedSession(role: 'admin' | 'user'): { userId: string; role: string; name: string; username: string } {
  const db = getTestDatabase();
  
  const user = db.prepare('SELECT id, username, name, role FROM users WHERE role = ? LIMIT 1').get(role) as DbUser | undefined;
  
  if (!user) {
    throw new Error(`No test user found with role: ${role}`);
  }

  return {
    userId: user.id,
    role: user.role,
    name: user.name,
    username: user.username,
  };
}

/**
 * Create a test invoice with specified net HT (subtotal)
 * The total will be calculated using DGI Standards 2026 fiscal logic
 * @param {number} netHt - The net hors tax amount (subtotal)
 * @param {string} clientId - Optional client ID (uses test client if not provided)
 * @returns {string} The created invoice ID
 */
export function createTestInvoice(netHt: number, clientId?: string): string {
  const db = getTestDatabase();
  
  let actualClientId: string;
  if (clientId) {
    actualClientId = clientId;
  } else {
    const clientResult = db.prepare('SELECT id FROM clients LIMIT 1').get() as { id: string } | undefined;
    if (!clientResult) {
      throw new Error('No client found in test database');
    }
    actualClientId = clientResult.id;
  }
  
  if (!actualClientId) {
    throw new Error('No client found in test database');
  }

  const invoiceId = crypto.randomUUID();
  const sequenceResult = db.prepare('SELECT current_value FROM sequences WHERE name = ?').get('invoice') as { current_value: number } | undefined;
  const currentSequence = sequenceResult?.current_value || 0;
  const invoiceNumber = `FAC-${String(currentSequence + 1)}/GM/2026`;
  
  // Calculate fiscal amounts using DGI Standards 2026
  const cssAmount = Math.round(netHt * 0.01);
  const taxBase = netHt + cssAmount;
  const tvaAmount = Math.round(taxBase * 0.18);
  const tpsAmount = Math.round(taxBase * 0.095);
  const total = netHt + cssAmount + tvaAmount + tpsAmount;
  
  db.prepare(`
    INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    invoiceId,
    invoiceNumber,
    actualClientId,
    'Test Client',
    'client@test.com',
    '2026-01-01',
    '2026-01-15',
    netHt,
    0,
    taxBase,
    tpsAmount,
    tvaAmount,
    cssAmount,
    total,
    'UNPAID',
    new Date().toISOString()
  );

  db.prepare("UPDATE sequences SET current_value = current_value + 1 WHERE name = 'invoice'").run();
  
  return invoiceId;
}

/**
 * Create a test payment for an invoice
 * @param {string} invoiceId - The invoice ID
 * @param {number} amount - The payment amount
 * @param {string} paymentMethod - The payment method
 * @returns {string} The created payment ID
 */
export function createTestPayment(invoiceId: string, amount: number, paymentMethod: string = 'cash'): string {
  const db = getTestDatabase();
  
  const paymentId = crypto.randomUUID();
  
  db.prepare(`
    INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    paymentId,
    invoiceId,
    Math.round(amount),
    paymentMethod,
    '2026-01-01',
    `REF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    new Date().toISOString()
  );
  
  return paymentId;
}

/**
 * Soft delete a payment
 * @param {string} paymentId - The payment ID to soft delete
 */
export function softDeletePayment(paymentId: string): void {
  const db = getTestDatabase();
  db.prepare("UPDATE payments SET deletedAt = datetime('now') WHERE id = ?").run(paymentId);
}

/**
 * Get total payments for an invoice (excluding soft-deleted)
 * @param {string} invoiceId - The invoice ID
 * @returns {number} Total payment amount
 */
export function getTotalPayments(invoiceId: string): number {
  const db = getTestDatabase();
  const result = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE invoiceId = ? AND deletedAt IS NULL').get(invoiceId) as DbTotal;
  return Math.round(result.total || 0);
}

/**
 * Get invoice status
 * @param {string} invoiceId - The invoice ID
 * @returns {string} The invoice status
 */
export function getInvoiceStatus(invoiceId: string): string {
  const db = getTestDatabase();
  const invoice = db.prepare('SELECT status FROM invoices WHERE id = ?').get(invoiceId) as { status: string } | undefined;
  return invoice?.status || 'UNKNOWN';
}

/**
 * Set invoice status
 * @param {string} invoiceId - The invoice ID
 * @param {string} status - The new status
 */
export function setInvoiceStatus(invoiceId: string, status: string): void {
  const db = getTestDatabase();
  db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(status, invoiceId);
}

/**
 * Get invoice total
 * @param {string} invoiceId - The invoice ID
 * @returns {number} The invoice total
 */
export function getInvoiceTotal(invoiceId: string): number {
  const db = getTestDatabase();
  const invoice = db.prepare('SELECT total FROM invoices WHERE id = ?').get(invoiceId) as { total: number } | undefined;
  return Math.round(invoice?.total || 0);
}
