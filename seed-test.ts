import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

const SALT = 'letoile-gabon-2026';
function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

console.log("Seeding test users...");

try {
  // Clear existing users for a clean state
  db.prepare("DELETE FROM users").run();

  const adminId = crypto.randomUUID();
  db.prepare('INSERT INTO users (id, username, password, name, role, email, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(adminId, 'admin@letoile.ga', hashPassword('admin123'), 'Administrateur Test', 'admin', 'admin@letoile.ga', 1);

  const userId = crypto.randomUUID();
  db.prepare('INSERT INTO users (id, username, password, name, role, email, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(userId, 'user@letoile.ga', hashPassword('user123'), 'Opérateur Test', 'user', 'user@letoile.ga', 1);

  console.log("Seed finished successfully.");
} catch (e) {
  console.error("Seed error:", e);
}
