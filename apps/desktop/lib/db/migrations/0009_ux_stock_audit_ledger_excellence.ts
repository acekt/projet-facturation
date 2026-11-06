import Database from 'better-sqlite3';
import { Migration } from './types';

function cleanPhysicalStockName(serviceName: string): string {
  if (!serviceName) return '';
  const cleaned = serviceName
    .trim()
    .replace(/^(achat\s+et\s+installation\s+d['’]|achat\s+et\s+installation\s+de\s+|achat\s+d['’]|achat\s+de\s+|achat\s+|fourniture\s+et\s+pose\s+d['’]|fourniture\s+et\s+pose\s+de\s+|fourniture\s+d['’]|fourniture\s+de\s+|vente\s+d['’]|vente\s+de\s+)/i, '')
    .trim();
  if (!cleaned) return serviceName.trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export const migration0009: Migration = {
  version: 9,
  name: '0009_ux_stock_audit_ledger_excellence',
  up(db: Database.Database) {
    const alterStatements = [
      'ALTER TABLE services ADD COLUMN stockItemName TEXT',
      'ALTER TABLE ledger_entries ADD COLUMN proofImage TEXT',
    ];

    for (const sql of alterStatements) {
      try {
        db.prepare(sql).run();
      } catch {
        // Colonne déjà existante (idempotent)
      }
    }

    // Table dédiée aux listes déroulantes éditables (Garantie Zéro Cascade)
    db.exec(`
      CREATE TABLE IF NOT EXISTS custom_select_options (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
        groupKey TEXT NOT NULL,
        value TEXT NOT NULL,
        label TEXT NOT NULL,
        isDeleted INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(tenant_id, groupKey, value)
      );
      CREATE INDEX IF NOT EXISTS idx_custom_select_options_group
        ON custom_select_options(tenant_id, groupKey, isDeleted);
    `);

    // Backfill intelligent de stockItemName pour les services suivis en stock existants
    try {
      const services = db
        .prepare("SELECT id, name, stockItemName FROM services WHERE stockItemName IS NULL OR trim(stockItemName) = ''")
        .all() as Array<{ id: string; name: string; stockItemName: string | null }>;
      const updateStmt = db.prepare('UPDATE services SET stockItemName = ? WHERE id = ?');
      for (const s of services) {
        const cleaned = cleanPhysicalStockName(s.name);
        if (cleaned) {
          updateStmt.run(cleaned, s.id);
        }
      }
    } catch {
      // Ignore si table absente
    }

    // Backfill des références de paiement vides
    try {
      const payments = db
        .prepare("SELECT id, date FROM payments WHERE reference IS NULL OR trim(reference) = ''")
        .all() as Array<{ id: string; date: string | null }>;
      const updatePaymentRef = db.prepare('UPDATE payments SET reference = ? WHERE id = ?');
      payments.forEach((p, idx) => {
        const datePart = (p.date || new Date().toISOString().slice(0, 10)).slice(0, 10).replace(/-/g, '');
        const suffix = String(1000 + ((idx * 137 + 421) % 9000)).padStart(4, '0');
        updatePaymentRef.run(`REG-${datePart}-${suffix}`, p.id);
      });
    } catch {
      // Ignore si table absente
    }

    // Correction orthographique "date démission" -> "date d'émission" dans settings
    try {
      db.prepare(`
        UPDATE settings
        SET mentionsLegales = REPLACE(mentionsLegales, 'date démission', 'date d''émission')
        WHERE mentionsLegales LIKE '%date démission%'
      `).run();
    } catch {
      // Ignore
    }

    // Backfill du nom d'utilisateur dans audit_logs lorsque userId est renseigné mais userName est NULL
    try {
      db.prepare(`
        UPDATE audit_logs
        SET userName = (
          SELECT COALESCE(u.name, u.username, 'Administrateur')
          FROM users u
          WHERE u.id = audit_logs.userId
        )
        WHERE (userName IS NULL OR trim(userName) = '')
          AND userId IS NOT NULL
      `).run();
    } catch {
      // Ignore
    }
  },
};
