import Database from 'better-sqlite3';
import { Migration } from './types';

export const migration0005: Migration = {
  version: 5,
  name: '0005_account_ledger',
  up(db: Database.Database) {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount INTEGER NOT NULL CHECK (amount >= 0),
        paymentMethod TEXT NOT NULL DEFAULT 'Espèces',
        reference TEXT,
        counterparty TEXT,
        linkedInvoiceId TEXT,
        linkedPaymentId TEXT,
        created_by TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        deletedAt TEXT
      )
    `).run();

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_ledger_tenant_date ON ledger_entries(tenant_id, date DESC)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_ledger_tenant_type ON ledger_entries(tenant_id, type)`).run();
  },
};