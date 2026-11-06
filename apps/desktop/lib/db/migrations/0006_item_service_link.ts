import Database from 'better-sqlite3';
import { Migration } from './types';

export const migration0006: Migration = {
  version: 6,
  name: '0006_item_service_link',
  up(db: Database.Database) {
    try {
      db.prepare('ALTER TABLE invoice_items ADD COLUMN serviceId TEXT REFERENCES services(id)').run();
    } catch {
      // Colonne déjà existante (idempotent)
    }

    try {
      db.prepare('ALTER TABLE credit_note_items ADD COLUMN serviceId TEXT REFERENCES services(id)').run();
    } catch {
      // Colonne déjà existante (idempotent)
    }

    try {
      db.prepare('ALTER TABLE quote_items ADD COLUMN serviceId TEXT REFERENCES services(id)').run();
    } catch {
      // Colonne déjà existante (idempotent)
    }

    try {
      db.prepare('CREATE INDEX IF NOT EXISTS idx_invoice_items_serviceId ON invoice_items(serviceId)').run();
    } catch {
      // Idempotent
    }

    try {
      db.prepare('CREATE INDEX IF NOT EXISTS idx_credit_note_items_serviceId ON credit_note_items(serviceId)').run();
    } catch {
      // Idempotent
    }

    try {
      db.prepare('CREATE INDEX IF NOT EXISTS idx_quote_items_serviceId ON quote_items(serviceId)').run();
    } catch {
      // Idempotent
    }
  },
};
