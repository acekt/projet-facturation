import db from '@/lib/db';
import { ROLES, INVOICE_STATUS } from '@/lib/constants';

type DbTotal = { total: number | null };
type DbCount = { count: number };

export const MetricsRepository = {
  getTotalRevenue(userId: string, role: string, dateFilter: string): number {
    let query = `
      SELECT COALESCE(ROUND(COALESCE(SUM(p.amount), 0), 0), 0) as total
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE ${dateFilter} AND p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('${INVOICE_STATUS.PAID}', '${INVOICE_STATUS.PARTIALLY_PAID}')
    `;
    const params: unknown[] = [];
    if (role !== ROLES.ADMIN) {
      query += ' AND i.created_by = ?';
      params.push(userId);
    }
    const row = db.prepare(query).get(...params) as DbTotal | undefined;
    return row?.total ?? 0;
  },

  getPendingRevenue(userId: string, role: string, dateFilter: string): number {
    // Reste à payer: total - amount already paid
    let query = `
      SELECT COALESCE(ROUND(SUM(
        i.total - COALESCE((SELECT SUM(amount) FROM payments WHERE invoiceId = i.id AND deletedAt IS NULL), 0)
      ), 0), 0) as total
      FROM invoices i
      WHERE ${dateFilter} AND i.deletedAt IS NULL AND i.status IN ('${INVOICE_STATUS.UNPAID}', '${INVOICE_STATUS.PARTIALLY_PAID}')
    `;
    const params: unknown[] = [];
    if (role !== ROLES.ADMIN) {
      query += ' AND created_by = ?';
      params.push(userId);
    }
    const row = db.prepare(query).get(...params) as DbTotal | undefined;
    return row?.total ?? 0;
  },

  getOverdueRevenue(userId: string, role: string): number {
    let query = `
      SELECT COALESCE(ROUND(COALESCE(SUM(total), 0), 0), 0) as total FROM invoices
      WHERE dueDate < date('now') AND status IN ('${INVOICE_STATUS.UNPAID}', '${INVOICE_STATUS.PARTIALLY_PAID}') AND deletedAt IS NULL
    `;
    const params: unknown[] = [];
    if (role !== ROLES.ADMIN) {
      query += ' AND created_by = ?';
      params.push(userId);
    }
    const row = db.prepare(query).get(...params) as DbTotal | undefined;
    return row?.total ?? 0;
  },

  getInvoiceCounts(userId: string, role: string) {
    const getCount = (statusWhere: string) => {
      let query = `SELECT COUNT(*) as count FROM invoices WHERE ${statusWhere} AND deletedAt IS NULL`;
      const params: unknown[] = [];
      if (role !== ROLES.ADMIN) {
        query += ' AND created_by = ?';
        params.push(userId);
      }
      return (db.prepare(query).get(...params) as DbCount | undefined)?.count ?? 0;
    };

    return {
      paidCount: getCount(`status = '${INVOICE_STATUS.PAID}'`),
      unpaidCount: getCount(`status = '${INVOICE_STATUS.UNPAID}'`),
      partiallyPaidCount: getCount(`status = '${INVOICE_STATUS.PARTIALLY_PAID}'`),
      totalInvoicesCount: getCount(`status != '${INVOICE_STATUS.CANCELLED}'`)
    };
  },

  getPendingQuotesCount(userId: string, role: string): number {
    let query = "SELECT COUNT(*) as count FROM quotes WHERE status NOT IN ('CONVERTI', 'REFUSE', 'EXPIRE', 'invoiced', 'archived', 'cancelled') AND deletedAt IS NULL";
    const params: unknown[] = [];
    if (role !== ROLES.ADMIN) {
      query += ' AND created_by = ?';
      params.push(userId);
    }
    const row = db.prepare(query).get(...params) as DbCount | undefined;
    return row?.count ?? 0;
  },

  getTopClients(userId: string, role: string) {
    let query = `
      SELECT clientName, COALESCE(ROUND(SUM(total), 0), 0) as totalRevenue
      FROM invoices
      WHERE deletedAt IS NULL AND status != '${INVOICE_STATUS.CANCELLED}'
    `;
    const params: unknown[] = [];
    if (role !== ROLES.ADMIN) {
      query += ' AND created_by = ?';
      params.push(userId);
    }
    query += ' GROUP BY clientName ORDER BY totalRevenue DESC LIMIT 5';
    return db.prepare(query).all(...params) as Array<{ clientName: string; totalRevenue: number }>;
  },

  getUserPerformance(role: string) {
    if (role !== ROLES.ADMIN) return [];
    return db.prepare(`
      SELECT u.name,
             COUNT(i.id) as docsCount,
             COALESCE(ROUND(COALESCE(SUM(i.total), 0), 0), 0) as totalRevenue
      FROM users u
      LEFT JOIN invoices i ON i.created_by = u.id AND i.deletedAt IS NULL AND i.status != '${INVOICE_STATUS.CANCELLED}'
      WHERE u.role IN ('${ROLES.USER}', '${ROLES.OPERATOR}')
      GROUP BY u.id, u.name
    `).all() as Array<{ name: string; docsCount: number; totalRevenue: number }>;
  },

  getDailyRevenueGrouped(userId: string, role: string, startDateStr: string) {
    let query = `
      SELECT p.date, COALESCE(ROUND(SUM(p.amount), 0), 0) as total
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE p.date >= ? AND p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('${INVOICE_STATUS.PAID}', '${INVOICE_STATUS.PARTIALLY_PAID}')
    `;
    const params: unknown[] = [startDateStr];
    if (role !== ROLES.ADMIN) {
      query += ' AND i.created_by = ?';
      params.push(userId);
    }
    query += ' GROUP BY p.date';
    return db.prepare(query).all(...params) as Array<{ date: string; total: number }>;
  },

  getMonthlyRevenueGrouped(userId: string, role: string) {
    let query = `
      SELECT strftime('%m', p.date) as monthStr, COALESCE(ROUND(SUM(p.amount), 0), 0) as total
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE strftime('%Y', p.date) = strftime('%Y', 'now') AND p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('${INVOICE_STATUS.PAID}', '${INVOICE_STATUS.PARTIALLY_PAID}')
    `;
    const params: unknown[] = [];
    if (role !== ROLES.ADMIN) {
      query += ' AND i.created_by = ?';
      params.push(userId);
    }
    query += ' GROUP BY monthStr';
    return db.prepare(query).all(...params) as Array<{ monthStr: string; total: number }>;
  },

  getPaymentMethodDistribution(userId: string, role: string) {
    let countQuery = `
      SELECT COUNT(*) as count
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('${INVOICE_STATUS.PAID}', '${INVOICE_STATUS.PARTIALLY_PAID}')
    `;
    let groupQuery = `
      SELECT p.paymentMethod, COUNT(*) as count
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('${INVOICE_STATUS.PAID}', '${INVOICE_STATUS.PARTIALLY_PAID}')
    `;

    const params: unknown[] = [];
    if (role !== ROLES.ADMIN) {
      const userClause = ' AND i.created_by = ?';
      countQuery += userClause;
      groupQuery += userClause;
      params.push(userId);
    }
    groupQuery += ' GROUP BY p.paymentMethod';

    const totalRow = db.prepare(countQuery).get(...params) as DbCount | undefined;
    const totalCount = totalRow?.count || 1; // Prevent division by zero

    const methods = db.prepare(groupQuery).all(...params) as Array<{ paymentMethod: string; count: number }>;
    return { totalCount, methods };
  },

  getRecentActivity(userId: string, role: string) {
    let query = `SELECT id, action, details, createdAt, userName FROM audit_logs`;
    const params: unknown[] = [];
    if (role !== ROLES.ADMIN) {
      query += ' WHERE userId = ?';
      params.push(userId);
    }
    query += ' ORDER BY createdAt DESC LIMIT 5';
    return db.prepare(query).all(...params) as Array<{ id: string; action: string; details: string; createdAt: string; userName: string | null }>;
  }
};
