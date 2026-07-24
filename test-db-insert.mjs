import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
const db = new Database(dbPath);

const p = 'operator123';
const operatorHash = bcrypt.hashSync(p, 10);
const operatorId = crypto.randomUUID();

db.prepare(`
    INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
    VALUES (?, ?, ?, ?, 'admin', ?, 1, CURRENT_TIMESTAMP)
`).run(operatorId, 'testop@phase3.com', 'testop@phase3.com', operatorHash, 'Test Op');

const u = db.prepare("SELECT * FROM users WHERE email = 'testop@phase3.com'").get();
console.log(u);
db.close();
