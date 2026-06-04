import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

console.log('🧹 Purge complète de la base de données...');

const SALT = 'letoile-gabon-2026';
function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

// Ensure users table has created_at column
try {
  const usersColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!usersColumns.some(c => c.name === 'created_at')) {
    db.prepare("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP").run();
    console.log('✅ Added created_at column to users table');
  }
} catch (e) {
  console.error('Error checking users table:', e);
}

db.pragma('foreign_keys = OFF');
db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM payments;
    DELETE FROM invoice_items;
    DELETE FROM invoices;
    DELETE FROM quote_items;
    DELETE FROM quotes;
    DELETE FROM credit_note_items;
    DELETE FROM credit_notes;
    DELETE FROM services;
    DELETE FROM clients;
    DELETE FROM users;
    DELETE FROM sequences;
`);
db.pragma('foreign_keys = ON');

// Reset sequences
db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('quote', 0, strftime('%Y', 'now'))").run();
db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('invoice', 0, strftime('%Y', 'now'))").run();

// System users only
const adminId = crypto.randomUUID();
db.prepare(`
    INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
`).run(adminId, 'admin@letoile.ga', 'admin@letoile.ga', hashPassword('admin123'), 'admin', 'Administrateur Système');

const operatorId = crypto.randomUUID();
db.prepare(`
    INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
`).run(operatorId, 'operateur@letoile.ga', 'operateur@letoile.ga', hashPassword('operateur123'), 'user', 'Opérateur Standard');

// Demo data for testing
console.log('📝 Ajout de données de démonstration...');

// Demo client
const clientId = crypto.randomUUID();
db.prepare(`
    INSERT INTO clients (id, name, email, phone, address, status, createdAt)
    VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
`).run(clientId, 'CGA Gabon', 'contact@cga.ga', '+241 01 23 45 67', 'Libreville, Gabon');

// Demo service
const serviceId = crypto.randomUUID();
db.prepare(`
    INSERT INTO services (id, name, description, category, unitPrice, createdAt)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
`).run(serviceId, 'Maintenance Préventive', 'Entretien mensuel des équipements', 'Maintenance', 50000);

// Demo quote
const quoteId = crypto.randomUUID();
db.prepare(`
    INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, notes, createdAt, created_by)
    VALUES (?, 'DEV-001/CGA/2026', ?, ?, ?, CURRENT_DATE, DATE(CURRENT_DATE, '+30 days'), 50000, 0, 50000, 9000, 4750, 500, 64250, 'sent', 'Devis de démonstration', CURRENT_TIMESTAMP, ?)
`).run(quoteId, clientId, 'CGA Gabon', 'contact@cga.ga', operatorId);

db.prepare(`
    INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
    VALUES (?, ?, ?, ?, ?, ?)
`).run(crypto.randomUUID(), quoteId, 'Maintenance Préventive', 1, 50000, 50000);

// Demo invoice
const invoiceId = crypto.randomUUID();
db.prepare(`
    INSERT INTO invoices (id, number, quoteId, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, notes, createdAt, created_by)
    VALUES (?, 'FAC-001/CGA/2026', ?, ?, ?, ?, CURRENT_DATE, DATE(CURRENT_DATE, '+30 days'), 50000, 0, 50000, 9000, 4750, 500, 64250, 'UNPAID', 'Facture de démonstration', CURRENT_TIMESTAMP, ?)
`).run(invoiceId, quoteId, clientId, 'CGA Gabon', 'contact@cga.ga', operatorId);

db.prepare(`
    INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total)
    VALUES (?, ?, ?, ?, ?, ?)
`).run(crypto.randomUUID(), invoiceId, 'Maintenance Préventive', 1, 50000, 50000);

// Demo payment
const paymentId = crypto.randomUUID();
db.prepare(`
    INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, createdAt)
    VALUES (?, ?, ?, ?, CURRENT_DATE, 'PAY-001', CURRENT_TIMESTAMP)
`).run(paymentId, invoiceId, 30000, 'cash');

// Update invoice status to partially paid
db.prepare("UPDATE invoices SET status = 'PARTIALLY_PAID' WHERE id = ?").run(invoiceId);

console.log('✅ Base de données réinitialisée à 100%.');
console.log('Accès Admin : admin@letoile.ga / admin123');
console.log('Accès Opérateur : operateur@letoile.ga / operateur123');
console.log('📊 Données de démo ajoutées: 1 client, 1 service, 1 devis, 1 facture, 1 paiement');
