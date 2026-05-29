import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

console.log("Starting explicit migration...");

try {
  const usersColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;

  if (!usersColumns.some(c => c.name === 'is_active')) {
    db.prepare("ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1").run();
    console.log("Added is_active");
  }
  if (!usersColumns.some(c => c.name === 'force_password_change')) {
    db.prepare("ALTER TABLE users ADD COLUMN force_password_change INTEGER NOT NULL DEFAULT 0").run();
    console.log("Added force_password_change");
  }
  if (!usersColumns.some(c => c.name === 'last_login_at')) {
    db.prepare("ALTER TABLE users ADD COLUMN last_login_at DATETIME").run();
    console.log("Added last_login_at");
  }
  if (!usersColumns.some(c => c.name === 'created_by')) {
    db.prepare("ALTER TABLE users ADD COLUMN created_by TEXT").run();
    console.log("Added created_by");
  }
  if (!usersColumns.some(c => c.name === 'email')) {
    db.prepare("ALTER TABLE users ADD COLUMN email TEXT").run();
    db.prepare("UPDATE users SET email = username").run();
    console.log("Added email");
  }
} catch (e) {
  console.error("Migration error:", e);
}

console.log("Migration finished.");
