import Database from 'better-sqlite3';
import { Migration } from './types';

export const migration0010: Migration = {
  version: 10,
  name: '0010_high_load_indexes',
  up(db: Database.Database) {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ledger_tenant_active_date 
        ON ledger_entries(tenant_id, deletedAt, date DESC, type);

      CREATE INDEX IF NOT EXISTS idx_ledger_tenant_category 
        ON ledger_entries(tenant_id, deletedAt, category);

      CREATE INDEX IF NOT EXISTS idx_stock_movements_service_date 
        ON stock_movements(tenant_id, serviceId, createdAt DESC);

      CREATE INDEX IF NOT EXISTS idx_services_tenant_stock 
        ON services(tenant_id, deletedAt, trackStock);

      CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created 
        ON audit_logs(tenant_id, createdAt DESC);

      CREATE INDEX IF NOT EXISTS idx_payments_tenant_invoice 
        ON payments(tenant_id, invoiceId, deletedAt);

      CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant_invoice 
        ON credit_notes(tenant_id, invoiceId, deletedAt);
    `);
  },
};

