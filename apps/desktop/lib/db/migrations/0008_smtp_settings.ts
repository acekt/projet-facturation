import Database from 'better-sqlite3';
import { Migration } from './types';

export const migration0008: Migration = {
  version: 8,
  name: '0008_smtp_settings',
  up(db: Database.Database) {
    const columns = [
      'ALTER TABLE settings ADD COLUMN smtpHost TEXT',
      'ALTER TABLE settings ADD COLUMN smtpPort INTEGER DEFAULT 587',
      'ALTER TABLE settings ADD COLUMN smtpUser TEXT',
      'ALTER TABLE settings ADD COLUMN smtpPass TEXT',
      'ALTER TABLE settings ADD COLUMN smtpSecure INTEGER DEFAULT 0',
    ];

    for (const sql of columns) {
      try {
        db.prepare(sql).run();
      } catch {
        // Colonne déjà présente (idempotent)
      }
    }
  },
};

