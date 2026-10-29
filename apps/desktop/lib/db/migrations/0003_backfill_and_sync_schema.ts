import Database from 'better-sqlite3';
import { Migration } from './types';
import { ensureSyncSchema } from '../../sync/localSchema';

export const migration0003: Migration = {
  version: 3,
  name: '0003_backfill_and_sync_schema',
  up(db: Database.Database) {
    // 1. Backfill payments.created_by from parent invoice if null
    db.prepare(
      'UPDATE payments SET created_by = (SELECT created_by FROM invoices WHERE id = payments.invoiceId) WHERE created_by IS NULL'
    ).run();

    // 2. Backfill orphaned created_by to first admin if present
    const firstAdmin = db
      .prepare("SELECT id, tenant_id FROM users WHERE role = 'admin' LIMIT 1")
      .get() as { id: string; tenant_id?: string | null } | undefined;

    if (firstAdmin?.id) {
      db.prepare('UPDATE clients SET created_by = ? WHERE created_by IS NULL').run(firstAdmin.id);
      db.prepare('UPDATE services SET created_by = ? WHERE created_by IS NULL').run(firstAdmin.id);
      db.prepare('UPDATE quotes SET created_by = ? WHERE created_by IS NULL').run(firstAdmin.id);
      db.prepare('UPDATE invoices SET created_by = ? WHERE created_by IS NULL').run(firstAdmin.id);
    }

    // 3. Ensure Cloud Sync columns and triggers (_sync_outbox)
    ensureSyncSchema(db);
  },
};

