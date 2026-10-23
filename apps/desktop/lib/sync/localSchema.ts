import type Database from 'better-sqlite3';

/**
 * Configuration des tables synchronisées avec Supabase.
 * L'ordre respecte les dépendances de clés étrangères (parents avant enfants).
 */
export interface SyncTableConfig {
  /** Nom de la table SQLite locale */
  local: string;
  /** Nom de la table Supabase */
  remote: string;
  /** Clé primaire côté Supabase */
  remotePk: string;
  /** Table "singleton" (settings : id=1 local <-> tenant_id côté cloud) */
  singleton?: boolean;
}

export const SYNC_TABLES: SyncTableConfig[] = [
  { local: 'settings', remote: 'tenant_settings', remotePk: 'tenant_id', singleton: true },
  { local: 'clients', remote: 'clients', remotePk: 'id' },
  { local: 'services', remote: 'services', remotePk: 'id' },
  { local: 'quotes', remote: 'quotes', remotePk: 'id' },
  { local: 'quote_items', remote: 'quote_items', remotePk: 'id' },
  { local: 'invoices', remote: 'invoices', remotePk: 'id' },
  { local: 'invoice_items', remote: 'invoice_items', remotePk: 'id' },
  { local: 'payments', remote: 'payments', remotePk: 'id' },
  { local: 'credit_notes', remote: 'credit_notes', remotePk: 'id' },
  { local: 'credit_note_items', remote: 'credit_note_items', remotePk: 'id' },
  { local: 'audit_logs', remote: 'audit_logs', remotePk: 'id' },
];

const NOW_ISO = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

/**
 * Prépare la base SQLite locale pour la synchronisation :
 *  - colonnes updated_at / synced_at (suivi des modifications)
 *  - triggers qui horodatent automatiquement chaque INSERT/UPDATE (aucune modification
 *    des repositories nécessaire)
 *  - table sync_tombstones pour propager les suppressions physiques (items)
 *  - table sync_meta pour les curseurs de pull
 * Idempotent.
 */
export function ensureSyncSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_tombstones (
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      deleted_at TEXT NOT NULL DEFAULT (${NOW_ISO}),
      PRIMARY KEY (table_name, record_id)
    );
    CREATE TABLE IF NOT EXISTS pending_cloud_members (
      email TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW_ISO})
    );
  `);

  for (const { local, singleton } of SYNC_TABLES) {
    const cols = db.prepare(`PRAGMA table_info(${local})`).all() as Array<{ name: string }>;
    if (cols.length === 0) continue;

    if (!cols.some((c) => c.name === 'updated_at')) {
      db.exec(`ALTER TABLE ${local} ADD COLUMN updated_at TEXT`);
    }
    if (!cols.some((c) => c.name === 'synced_at')) {
      db.exec(`ALTER TABLE ${local} ADD COLUMN synced_at TEXT`);
    }
    // Backfill des lignes existantes
    db.exec(`UPDATE ${local} SET updated_at = ${NOW_ISO} WHERE updated_at IS NULL`);

    db.exec(`
      DROP TRIGGER IF EXISTS trg_${local}_sync_ins;
      CREATE TRIGGER trg_${local}_sync_ins AFTER INSERT ON ${local}
      WHEN NEW.updated_at IS NULL
      BEGIN
        UPDATE ${local} SET updated_at = ${NOW_ISO} WHERE rowid = NEW.rowid;
      END;

      DROP TRIGGER IF EXISTS trg_${local}_sync_upd;
      CREATE TRIGGER trg_${local}_sync_upd AFTER UPDATE ON ${local}
      WHEN NEW.updated_at IS OLD.updated_at AND NEW.synced_at IS OLD.synced_at
      BEGIN
        UPDATE ${local} SET updated_at = ${NOW_ISO} WHERE rowid = NEW.rowid;
      END;
    `);

    if (!singleton) {
      db.exec(`
        DROP TRIGGER IF EXISTS trg_${local}_sync_del;
        CREATE TRIGGER trg_${local}_sync_del AFTER DELETE ON ${local}
        BEGIN
          INSERT OR REPLACE INTO sync_tombstones (table_name, record_id) VALUES ('${local}', OLD.id);
        END;
      `);
    }
  }
}
