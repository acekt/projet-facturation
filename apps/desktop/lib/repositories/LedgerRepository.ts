import db from '@/lib/db';
import { logAudit } from '@/lib/api/audit';
import crypto from 'crypto';

export type LedgerEntryType = 'IN' | 'OUT';

export interface LedgerEntry {
  id: string;
  tenant_id: string;
  date: string;
  type: LedgerEntryType;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  reference?: string | null;
  counterparty?: string | null;
  linkedInvoiceId?: string | null;
  linkedPaymentId?: string | null;
  proofImage?: string | null;
  hasProofImage?: number | boolean;
  created_by?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface LedgerSummary {
  totalIn: number;
  totalOut: number;
  netBalance: number;
  countIn: number;
  countOut: number;
  byCategory: Record<string, number>;
  byPaymentMethod: Record<string, number>;
}

export interface LedgerFilters {
  tenantId: string;
  month?: string; // YYYY-MM
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  type?: 'ALL' | 'IN' | 'OUT';
  category?: string;
  paymentMethod?: string;
  search?: string;
}

export const LedgerRepository = {
  findAll(filters: LedgerFilters): LedgerEntry[] {
    let sql = `
      SELECT
        id, tenant_id, date, type, category, description, amount,
        paymentMethod, reference, counterparty, linkedInvoiceId, linkedPaymentId,
        CASE WHEN proofImage IS NOT NULL AND length(proofImage) > 0 THEN 1 ELSE 0 END AS hasProofImage,
        created_by, createdAt, updatedAt, deletedAt
      FROM ledger_entries
      WHERE tenant_id = ? AND deletedAt IS NULL
    `;
    const params: any[] = [filters.tenantId];

    if (filters.month) {
      sql += " AND strftime('%Y-%m', date) = ?";
      params.push(filters.month);
    }
    if (filters.startDate) {
      sql += ' AND date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND date <= ?';
      params.push(filters.endDate);
    }
    if (filters.type && filters.type !== 'ALL') {
      sql += ' AND type = ?';
      params.push(filters.type);
    }
    if (filters.category) {
      sql += ' AND category = ?';
      params.push(filters.category);
    }
    if (filters.paymentMethod) {
      sql += ' AND paymentMethod = ?';
      params.push(filters.paymentMethod);
    }
    if (filters.search) {
      sql += ' AND (description LIKE ? OR reference LIKE ? OR counterparty LIKE ?)';
      const searchParam = `%${filters.search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    sql += ' ORDER BY date DESC, createdAt DESC';

    const stmt = db.prepare(sql);
    return stmt.all(...params) as LedgerEntry[];
  },

  getProofImage(id: string, tenantId?: string): string | null {
    const sql = tenantId
      ? 'SELECT proofImage FROM ledger_entries WHERE id = ? AND tenant_id = ? AND deletedAt IS NULL'
      : 'SELECT proofImage FROM ledger_entries WHERE id = ? AND deletedAt IS NULL';
    const row = (tenantId ? db.prepare(sql).get(id, tenantId) : db.prepare(sql).get(id)) as
      | { proofImage?: string | null }
      | undefined;
    return row?.proofImage ?? null;
  },

  getSummary(filters: LedgerFilters): LedgerSummary {
    let baseSql = 'FROM ledger_entries WHERE tenant_id = ? AND deletedAt IS NULL';
    const params: any[] = [filters.tenantId];

    if (filters.month) {
      baseSql += " AND strftime('%Y-%m', date) = ?";
      params.push(filters.month);
    }
    if (filters.startDate) {
      baseSql += ' AND date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      baseSql += ' AND date <= ?';
      params.push(filters.endDate);
    }

    // Totals and counts
    const summaryStmt = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0) as totalIn,
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0) as totalOut,
        SUM(CASE WHEN type = 'IN' THEN 1 ELSE 0 END) as countIn,
        SUM(CASE WHEN type = 'OUT' THEN 1 ELSE 0 END) as countOut
      ${baseSql}
    `);
    const summaryResult = summaryStmt.get(...params) as { totalIn: number; totalOut: number; countIn: number; countOut: number };

    // Group by category
    const catStmt = db.prepare(`SELECT category, COALESCE(SUM(amount), 0) as total ${baseSql} GROUP BY category`);
    const catResult = catStmt.all(...params) as { category: string; total: number }[];
    const byCategory: Record<string, number> = {};
    for (const row of catResult) {
      byCategory[row.category] = row.total;
    }

    // Group by payment method (solde net = Entrées - Sorties)
    const payStmt = db.prepare(`SELECT paymentMethod, COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END), 0) as total ${baseSql} GROUP BY paymentMethod`);
    const payResult = payStmt.all(...params) as { paymentMethod: string; total: number }[];
    const byPaymentMethod: Record<string, number> = {};
    for (const row of payResult) {
      byPaymentMethod[row.paymentMethod] = row.total;
    }

    return {
      totalIn: summaryResult.totalIn,
      totalOut: summaryResult.totalOut,
      netBalance: summaryResult.totalIn - summaryResult.totalOut,
      countIn: summaryResult.countIn,
      countOut: summaryResult.countOut,
      byCategory,
      byPaymentMethod,
    };
  },

  create(entry: Omit<LedgerEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): LedgerEntry {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO ledger_entries (
        id, tenant_id, date, type, category, description, amount, paymentMethod, reference, counterparty, linkedInvoiceId, linkedPaymentId, proofImage, created_by, createdAt, updatedAt
      ) VALUES (
        @id, @tenant_id, @date, @type, @category, @description, @amount, @paymentMethod, @reference, @counterparty, @linkedInvoiceId, @linkedPaymentId, @proofImage, @created_by, @createdAt, @updatedAt
      )
    `).run({
      ...entry,
      id,
      createdAt,
      updatedAt: createdAt,
      reference: entry.reference || null,
      counterparty: entry.counterparty || null,
      linkedInvoiceId: entry.linkedInvoiceId || null,
      linkedPaymentId: entry.linkedPaymentId || null,
      proofImage: entry.proofImage || null,
      created_by: entry.created_by || null,
    });

    return {
      ...entry,
      id,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    };
  },

  softDelete(id: string, tenantId: string, userId?: string, userName?: string): boolean {
    const info = db.prepare(`UPDATE ledger_entries SET deletedAt = datetime('now') WHERE id = ? AND tenant_id = ?`).run(id, tenantId);
    if (info.changes > 0) {
      logAudit('DELETE', 'ledger_entry', id, `Suppression de l'écriture ${id}`, userId || 'system', userName || 'System', tenantId);
      return true;
    }
    return false;
  }
};
