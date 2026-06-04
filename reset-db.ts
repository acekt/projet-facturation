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

// Initial Admin
const adminId = crypto.randomUUID();
db.prepare(`
    INSERT INTO users (id, username, email, password, role, name, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
`).run(adminId, 'admin@letoile.ga', 'admin@letoile.ga', hashPassword('admin123'), 'admin', 'Administrateur Système');

console.log('✅ Base de données réinitialisée à 100%.');
console.log('Accès Admin : admin@letoile.ga / admin123');
