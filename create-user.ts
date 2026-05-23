import Database from 'better-sqlite3';
import crypto from 'crypto';

const db = new Database('database.sqlite');

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Check if users table exists
const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();

if (!tableExists) {
  console.log('Creating users table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'admin',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Delete existing users to start fresh
db.prepare('DELETE FROM users').run();

// Create admin user
const adminId = crypto.randomUUID();
const adminPassword = hashPassword('admin123');
db.prepare('INSERT INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)')
  .run(adminId, 'admin', adminPassword, 'Administrateur', 'admin');

// Create standard user
const userId = crypto.randomUUID();
const userPassword = hashPassword('user123');
db.prepare('INSERT INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)')
  .run(userId, 'user', userPassword, 'Utilisateur Standard', 'user');

console.log('✅ Users created successfully');
console.log('\n=== IDENTIFIANTS DE CONNEXION ===');
console.log('\n🔑 ADMIN:');
console.log('Username: admin');
console.log('Password: admin123');
console.log('\n🔑 UTILISATEUR STANDARD:');
console.log('Username: user');
console.log('Password: user123');
console.log('\n================================\n');

db.close();
