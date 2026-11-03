import Database from 'better-sqlite3';
import { Migration } from './types';

export const migration0004: Migration = {
  version: 4,
  name: '0004_stock_management',
  up(db: Database.Database) {
    // 1. Add columns to services
    db.prepare("ALTER TABLE services ADD COLUMN trackStock INTEGER NOT NULL DEFAULT 0").run();
    db.prepare("ALTER TABLE services ADD COLUMN stockQuantity INTEGER NOT NULL DEFAULT 0").run();
    db.prepare("ALTER TABLE services ADD COLUMN minStockAlert INTEGER NOT NULL DEFAULT 5").run();
    db.prepare("ALTER TABLE services ADD COLUMN unit TEXT DEFAULT 'Unité'").run();

    // 2. Create stock_movements table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        serviceId TEXT NOT NULL,
        type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        previousStock INTEGER NOT NULL,
        newStock INTEGER NOT NULL,
        referenceDoc TEXT,
        notes TEXT,
        created_by TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        deletedAt TEXT,
        FOREIGN KEY (serviceId) REFERENCES services(id)
      )
    `).run();
  },
};
