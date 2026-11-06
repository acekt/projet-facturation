import db from '@/lib/db';
import { ROLES, INVOICE_STATUS } from '@/lib/constants';
import { buildTenantFilter, resolveActiveTenantId } from '@/lib/api/tenant';
import type {
  LedgerSummaryMetrics,
  ForecastMetrics,
  StockDashboardMetrics,
  QuotesPipelineMetrics,
} from '@/lib/types/api';

type DbTotal = { total: number | null };
type DbCount = { count: number };

export const MetricsRepository = {
  getTotalRevenue(userId: string, role: string, dateFilter: string, tenantId?: string | null): number {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId, 'i');

    let query = `
      SELECT COALESCE(ROUND(COALESCE(SUM(p.amount), 0), 0), 0) as total
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE ${dateFilter} AND p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('${INVOICE_STATUS.PAID}', '${INVOICE_STATUS.PARTIALLY_PAID}')${tf.sql}
    `;
    const params: unknown[] = [...tf.params];
    if (role !== ROLES.ADMIN) {
      query += ' AND i.created_by = ?';
      params.push(userId);
    }
    const row = db.prepare(query).get(...params) as DbTotal | undefined;
    return row?.total ?? 0;
  },

  getPendingRevenue(
    userId: string,
    role: string,
    dateFilter: string,
    tenantId?: string | null,
    netOfCreditNotes: boolean = false
  ): number {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId, 'i');

    const creditNotesSubquery = netOfCreditNotes
      ? " - COALESCE((SELECT SUM(total) FROM credit_notes WHERE invoiceId = i.id AND COALESCE(deletedAt, '') = ''), 0)"
      : "";

    let query = `
      SELECT COALESCE(ROUND(SUM(
        MAX(0, i.total - COALESCE((SELECT SUM(amount) FROM payments WHERE invoiceId = i.id AND deletedAt IS NULL), 0)${creditNotesSubquery})
      ), 0), 0) as total
      FROM invoices i
      WHERE ${dateFilter} AND i.deletedAt IS NULL AND i.status IN ('${INVOICE_STATUS.UNPAID}', '${INVOICE_STATUS.PARTIALLY_PAID}')${tf.sql}
    `;
    const params: unknown[] = [...tf.params];
    if (role !== ROLES.ADMIN) {
      query += ' AND i.created_by = ?';
      params.push(userId);
    }
    const row = db.prepare(query).get(...params) as DbTotal | undefined;
    return row?.total ?? 0;
  },

  getOverdueRevenue(userId: string, role: string, tenantId?: string | null): number {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId, 'i');

    let query = `
      SELECT COALESCE(ROUND(SUM(MAX(0, i.total - COALESCE((SELECT SUM(amount) FROM payments WHERE invoiceId = i.id AND deletedAt IS NULL), 0) - COALESCE((SELECT SUM(total) FROM credit_notes WHERE invoiceId = i.id AND COALESCE(deletedAt, '') = ''), 0))), 0), 0) as total FROM invoices i
      WHERE dueDate < date('now') AND status IN ('${INVOICE_STATUS.UNPAID}', '${INVOICE_STATUS.PARTIALLY_PAID}') AND deletedAt IS NULL${tf.sql}
    `;
    const params: unknown[] = [...tf.params];
    if (role !== ROLES.ADMIN) {
      query += ' AND created_by = ?';
      params.push(userId);
    }
    const row = db.prepare(query).get(...params) as DbTotal | undefined;
    return row?.total ?? 0;
  },

  getInvoiceCounts(userId: string, role: string, dateFilter: 'month' | 'quarter' | 'year' | 'all' = 'month', tenantId?: string | null) {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);

    let dateSql = "1=1";
    if (dateFilter === 'month') {
      dateSql = "date >= date('now', '-30 days')";
    } else if (dateFilter === 'quarter') {
      dateSql = "date >= date('now', '-3 months')";
    } else if (dateFilter === 'year') {
      dateSql = "strftime('%Y', date) = strftime('%Y', 'now')";
    } else if (dateFilter === 'all') {
      dateSql = "1=1";
    }

    const getCount = (statusWhere: string, ignoreDate: boolean = false) => {
      const whereClause = ignoreDate ? `(${statusWhere})` : `(${statusWhere}) AND (${dateSql})`;
      let query = `SELECT COUNT(*) as count FROM invoices WHERE ${whereClause} AND deletedAt IS NULL${tf.sql}`;
      const params: unknown[] = [...tf.params];
      if (role !== ROLES.ADMIN) {
        query += ' AND created_by = ?';
        params.push(userId);
      }
      return (db.prepare(query).get(...params) as DbCount | undefined)?.count ?? 0;
    };

    const getNetUnpaidCount = () => {
      const tfI = buildTenantFilter(activeTenantId, 'i');
      let query = `
        SELECT COUNT(*) as count FROM invoices i
        WHERE i.deletedAt IS NULL
          AND UPPER(i.status) NOT IN ('DRAFT', 'BROUILLON', 'CANCELLED', 'ANNULEE', 'PAID', 'PAYEE')
          AND (i.total - COALESCE((SELECT SUM(amount) FROM payments WHERE invoiceId = i.id AND deletedAt IS NULL), 0) - COALESCE((SELECT SUM(total) FROM credit_notes WHERE invoiceId = i.id AND (deletedAt IS NULL OR deletedAt = '')), 0)) > 0
          ${tfI.sql}
      `;
      const params: unknown[] = [...tfI.params];
      if (role !== ROLES.ADMIN) {
        query += ' AND i.created_by = ?';
        params.push(userId);
      }
      return (db.prepare(query).get(...params) as DbCount | undefined)?.count ?? 0;
    };

    const netUnpaid = getNetUnpaidCount();
    return {
      paidCount: getCount(`UPPER(status) = 'PAID'`),
      unpaidCount: netUnpaid,
      partiallyPaidCount: 0,
      totalInvoicesCount: getCount(`UPPER(status) != 'CANCELLED'`)
    };
  },

  getPendingQuotesCount(userId: string, role: string, tenantId?: string | null): number {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);

    let query = `SELECT COUNT(*) as count FROM quotes WHERE UPPER(status) NOT IN ('CONVERTI', 'REFUSE', 'EXPIRE', 'EXPIRED', 'REJECTED', 'DRAFT', 'BROUILLON', 'INVOICED', 'ARCHIVED', 'CANCELLED') AND deletedAt IS NULL AND (validUntil IS NULL OR date(validUntil) >= date('now'))${tf.sql}`;
    const params: unknown[] = [...tf.params];
    if (role !== ROLES.ADMIN) {
      query += ' AND created_by = ?';
      params.push(userId);
    }
    const row = db.prepare(query).get(...params) as DbCount | undefined;
    return row?.count ?? 0;
  },

  getTopClients(userId: string, role: string, tenantId?: string | null) {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);

    let query = `
      SELECT clientName, COALESCE(ROUND(SUM(total), 0), 0) as totalRevenue
      FROM invoices
      WHERE deletedAt IS NULL AND status != '${INVOICE_STATUS.CANCELLED}'${tf.sql}
    `;
    const params: unknown[] = [...tf.params];
    if (role !== ROLES.ADMIN) {
      query += ' AND created_by = ?';
      params.push(userId);
    }
    query += ' GROUP BY clientName ORDER BY totalRevenue DESC LIMIT 5';
    return db.prepare(query).all(...params) as Array<{ clientName: string; totalRevenue: number }>;
  },

  getUserPerformance(role: string, tenantId?: string | null) {
    if (role !== ROLES.ADMIN) return [];
    const tf = buildTenantFilter(tenantId, 'u');
    return db.prepare(`
      SELECT u.name,
             COUNT(i.id) as docsCount,
             COALESCE(ROUND(COALESCE(SUM(i.total), 0), 0), 0) as totalRevenue
      FROM users u
      LEFT JOIN invoices i ON i.created_by = u.id AND i.deletedAt IS NULL AND i.status != '${INVOICE_STATUS.CANCELLED}'
      WHERE u.role IN ('${ROLES.USER}', '${ROLES.OPERATOR}')${tf.sql}
      GROUP BY u.id, u.name
    `).all(...tf.params) as Array<{ name: string; docsCount: number; totalRevenue: number }>;
  },

  getDailyRevenueGrouped(userId: string, role: string, startDateStr: string, tenantId?: string | null) {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId, 'i');

    let query = `
      SELECT p.date, COALESCE(ROUND(SUM(p.amount), 0), 0) as total
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE p.date >= ? AND p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('${INVOICE_STATUS.PAID}', '${INVOICE_STATUS.PARTIALLY_PAID}')${tf.sql}
    `;
    const params: unknown[] = [startDateStr, ...tf.params];
    if (role !== ROLES.ADMIN) {
      query += ' AND i.created_by = ?';
      params.push(userId);
    }
    query += ' GROUP BY p.date';
    return db.prepare(query).all(...params) as Array<{ date: string; total: number }>;
  },

  getMonthlyRevenueGrouped(userId: string, role: string, tenantId?: string | null) {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId, 'i');

    let query = `
      SELECT strftime('%m', p.date) as monthStr, COALESCE(ROUND(SUM(p.amount), 0), 0) as total
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE strftime('%Y', p.date) = strftime('%Y', 'now') AND p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('${INVOICE_STATUS.PAID}', '${INVOICE_STATUS.PARTIALLY_PAID}')${tf.sql}
    `;
    const params: unknown[] = [...tf.params];
    if (role !== ROLES.ADMIN) {
      query += ' AND i.created_by = ?';
      params.push(userId);
    }
    query += ' GROUP BY monthStr';
    return db.prepare(query).all(...params) as Array<{ monthStr: string; total: number }>;
  },

  getPaymentMethodDistribution(userId: string, role: string, tenantId?: string | null) {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId, 'i');

    let countQuery = `
      SELECT COUNT(*) as count
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('${INVOICE_STATUS.PAID}', '${INVOICE_STATUS.PARTIALLY_PAID}')${tf.sql}
    `;
    let groupQuery = `
      SELECT p.paymentMethod, COUNT(*) as count
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('${INVOICE_STATUS.PAID}', '${INVOICE_STATUS.PARTIALLY_PAID}')${tf.sql}
    `;

    const params: unknown[] = [...tf.params];
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

  getRecentActivity(userId: string, role: string, tenantId?: string | null) {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);

    let query = `SELECT id, action, details, createdAt, userName FROM audit_logs WHERE 1=1${tf.sql}`;
    const params: unknown[] = [...tf.params];
    if (role !== ROLES.ADMIN) {
      query += ' AND userId = ?';
      params.push(userId);
    }
    query += " ORDER BY datetime(replace(createdAt, 'T', ' ')) DESC, rowid DESC LIMIT 5";
    return db.prepare(query).all(...params) as Array<{ id: string; action: string; details: string; createdAt: string; userName: string | null }>;
  },

  getLedgerSummary(userId: string, role: string, dateFilter: string, tenantId?: string | null): LedgerSummaryMetrics {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);

    // Filter date on ledger_entries: clean any alias prefixes from dateFilter (e.g. p.date -> date)
    const lDateFilter = dateFilter.replace(/\bp\./g, '').replace(/\bi\./g, '');

    const query = `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0) as totalIn,
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0) as totalOut
      FROM ledger_entries
      WHERE ${lDateFilter} AND deletedAt IS NULL${tf.sql}
    `;
    const row = db.prepare(query).get(...tf.params) as { totalIn: number; totalOut: number } | undefined;
    let totalIn = Math.round(row?.totalIn ?? 0);
    const totalOut = Math.round(row?.totalOut ?? 0);

    // Fallback: if ledger has no IN entries but payments exist, use total revenue for totalIn
    if (totalIn === 0) {
      const revenue = this.getTotalRevenue(userId, role, dateFilter, activeTenantId);
      if (revenue > 0) {
        totalIn = revenue;
      }
    }
    const netTreasury = totalIn - totalOut;

    // Average monthly expenses over the last 90 days (or all-time)
    const avgExpenseRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as totalExpenses
      FROM ledger_entries
      WHERE type = 'OUT' AND date >= date('now', '-90 days') AND deletedAt IS NULL${tf.sql}
    `).get(...tf.params) as { totalExpenses: number } | undefined;

    let averageMonthlyExpenses = Math.round((avgExpenseRow?.totalExpenses ?? 0) / 3);
    if (averageMonthlyExpenses === 0) {
      const allExpenseRow = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as totalExpenses
        FROM ledger_entries
        WHERE type = 'OUT' AND deletedAt IS NULL${tf.sql}
      `).get(...tf.params) as { totalExpenses: number } | undefined;
      averageMonthlyExpenses = Math.round(allExpenseRow?.totalExpenses ?? 0);
    }

    return {
      totalIn,
      totalOut,
      netTreasury,
      averageMonthlyExpenses,
    };
  },

  getDailyLedgerGrouped(startDateStr: string, activeTenantId?: string | null) {
    const tf = buildTenantFilter(activeTenantId);
    const query = `
      SELECT date,
             COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0) as income,
             COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0) as expense
      FROM ledger_entries
      WHERE date >= ? AND deletedAt IS NULL${tf.sql}
      GROUP BY date
    `;
    return db.prepare(query).all(startDateStr, ...tf.params) as Array<{ date: string; income: number; expense: number }>;
  },

  getMonthlyLedgerGrouped(activeTenantId?: string | null) {
    const tf = buildTenantFilter(activeTenantId);
    const query = `
      SELECT strftime('%m', date) as monthStr,
             COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0) as income,
             COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0) as expense
      FROM ledger_entries
      WHERE strftime('%Y', date) = strftime('%Y', 'now') AND deletedAt IS NULL${tf.sql}
      GROUP BY monthStr
    `;
    return db.prepare(query).all(...tf.params) as Array<{ monthStr: string; income: number; expense: number }>;
  },

  getDailyInvoicedGrouped(startDateStr: string, activeTenantId?: string | null) {
    const tf = buildTenantFilter(activeTenantId);
    const query = `
      SELECT date, COALESCE(SUM(total), 0) as total
      FROM invoices
      WHERE date >= ? AND deletedAt IS NULL AND status != '${INVOICE_STATUS.CANCELLED}'${tf.sql}
      GROUP BY date
    `;
    return db.prepare(query).all(startDateStr, ...tf.params) as Array<{ date: string; total: number }>;
  },

  getMonthlyInvoicedGrouped(activeTenantId?: string | null) {
    const tf = buildTenantFilter(activeTenantId);
    const query = `
      SELECT strftime('%m', date) as monthStr, COALESCE(SUM(total), 0) as total
      FROM invoices
      WHERE strftime('%Y', date) = strftime('%Y', 'now') AND deletedAt IS NULL AND status != '${INVOICE_STATUS.CANCELLED}'${tf.sql}
      GROUP BY monthStr
    `;
    return db.prepare(query).all(...tf.params) as Array<{ monthStr: string; total: number }>;
  },

  getForecastMetrics(
    userId: string,
    role: string,
    netTreasury: number,
    averageMonthlyExpenses: number,
    totalPaidRevenue: number,
    pendingRevenue: number,
    tenantId?: string | null
  ): ForecastMetrics {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId, 'i');
    const tfQuotes = buildTenantFilter(activeTenantId, 'q');

    // Expected inflows within next 30 days: unpaid/partially paid invoices maturing in [now, now+30d]
    let inflowsQuery = `
      SELECT COALESCE(ROUND(SUM(
        MAX(0, i.total -
          COALESCE((SELECT SUM(amount) FROM payments WHERE invoiceId = i.id AND deletedAt IS NULL), 0) -
          COALESCE((SELECT SUM(total) FROM credit_notes WHERE invoiceId = i.id AND (deletedAt IS NULL OR deletedAt = '')) , 0)
        )
      ), 0), 0) as total
      FROM invoices i
      WHERE i.deletedAt IS NULL
        AND i.status IN ('${INVOICE_STATUS.UNPAID}', '${INVOICE_STATUS.PARTIALLY_PAID}')
        AND date(i.dueDate) >= date('now')
        AND date(i.dueDate) <= date('now', '+30 days')
        ${tf.sql}
    `;
    const inflowsParams: unknown[] = [...tf.params];
    if (role !== ROLES.ADMIN) {
      inflowsQuery += ' AND i.created_by = ?';
      inflowsParams.push(userId);
    }
    const inflowsRow = db.prepare(inflowsQuery).get(...inflowsParams) as DbTotal | undefined;
    const expectedInflows30d = inflowsRow?.total ?? 0;

    // Active pending quotes pipeline
    let quotesQuery = `
      SELECT
        COUNT(*) as pendingCount,
        COALESCE(ROUND(SUM(q.total), 0), 0) as totalTtc
      FROM quotes q
      WHERE UPPER(q.status) NOT IN ('CONVERTI', 'REFUSE', 'EXPIRE', 'EXPIRED', 'REJECTED', 'DRAFT', 'BROUILLON', 'INVOICED', 'ARCHIVED', 'CANCELLED')
        AND q.deletedAt IS NULL
        AND (q.validUntil IS NULL OR date(q.validUntil) >= date('now'))
        ${tfQuotes.sql}
    `;
    const quotesParams: unknown[] = [...tfQuotes.params];
    if (role !== ROLES.ADMIN) {
      quotesQuery += ' AND q.created_by = ?';
      quotesParams.push(userId);
    }
    const quotesRow = db.prepare(quotesQuery).get(...quotesParams) as { pendingCount: number; totalTtc: number } | undefined;
    const totalPendingQuotesAmount = quotesRow?.totalTtc ?? 0;
    const weightedQuotesPipeline = Math.round(totalPendingQuotesAmount * 0.35);

    // Projected net cash at +30 days
    const projectedNetCash30d = netTreasury + expectedInflows30d + weightedQuotesPipeline - averageMonthlyExpenses;

    // Collection rate (%)
    const totalBilled = totalPaidRevenue + pendingRevenue;
    const collectionRate = totalBilled > 0 ? Math.min(100, Math.round((totalPaidRevenue / totalBilled) * 100)) : 100;

    // Quote conversion rate (%)
    let conversionQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN UPPER(q.status) IN ('CONVERTI', 'INVOICED', 'ACCEPTED', 'ACCEPTE') THEN 1 ELSE 0 END), 0) as convertedCount,
        COUNT(*) as totalQuotes
      FROM quotes q
      WHERE q.deletedAt IS NULL AND UPPER(q.status) NOT IN ('DRAFT', 'BROUILLON')
      ${tfQuotes.sql}
    `;
    const conversionParams: unknown[] = [...tfQuotes.params];
    if (role !== ROLES.ADMIN) {
      conversionQuery += ' AND q.created_by = ?';
      conversionParams.push(userId);
    }
    const conversionRow = db.prepare(conversionQuery).get(...conversionParams) as { convertedCount: number; totalQuotes: number } | undefined;
    const totalQuotes = conversionRow?.totalQuotes ?? 0;
    const convertedCount = conversionRow?.convertedCount ?? 0;
    const quoteConversionRate = totalQuotes > 0 ? Math.min(100, Math.round((convertedCount / totalQuotes) * 100)) : 0;

    return {
      expectedInflows30d,
      weightedQuotesPipeline,
      totalPendingQuotesAmount,
      projectedNetCash30d,
      collectionRate,
      quoteConversionRate,
    };
  },

  getStockMetrics(userId: string, role: string, tenantId?: string | null): StockDashboardMetrics {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);

    const countsRow = db.prepare(`
      SELECT
        COUNT(*) as trackedCount,
        COALESCE(SUM(CASE WHEN stockQuantity <= minStockAlert AND stockQuantity > 0 THEN 1 ELSE 0 END), 0) as lowStockCount,
        COALESCE(SUM(CASE WHEN stockQuantity <= 0 THEN 1 ELSE 0 END), 0) as outOfStockCount,
        COALESCE(ROUND(SUM(CASE WHEN stockQuantity > 0 THEN stockQuantity * unitPrice ELSE 0 END), 0), 0) as totalStockValue
      FROM services
      WHERE trackStock = 1 AND deletedAt IS NULL${tf.sql}
    `).get(...tf.params) as {
      trackedCount: number;
      lowStockCount: number;
      outOfStockCount: number;
      totalStockValue: number;
    } | undefined;

    const lowStockItems = db.prepare(`
      SELECT id, name, COALESCE(stockItemName, name) as physicalTitle, stockQuantity, minStockAlert, unitPrice
      FROM services
      WHERE trackStock = 1 AND deletedAt IS NULL${tf.sql}
      ORDER BY
        CASE
          WHEN stockQuantity <= 0 THEN 0
          WHEN stockQuantity <= minStockAlert THEN 1
          ELSE 2
        END ASC,
        stockQuantity ASC
      LIMIT 5
    `).all(...tf.params) as Array<{
      id: string;
      name: string;
      physicalTitle: string;
      stockQuantity: number;
      minStockAlert: number;
      unitPrice: number;
    }>;

    return {
      trackedCount: countsRow?.trackedCount ?? 0,
      lowStockCount: countsRow?.lowStockCount ?? 0,
      outOfStockCount: countsRow?.outOfStockCount ?? 0,
      totalStockValue: countsRow?.totalStockValue ?? 0,
      lowStockItems,
    };
  },

  getQuotesPipelineDetails(userId: string, role: string, tenantId?: string | null): QuotesPipelineMetrics {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);

    let query = `
      SELECT
        COUNT(*) as count,
        COALESCE(ROUND(SUM(total), 0), 0) as ttc,
        COALESCE(ROUND(SUM(subtotal), 0), 0) as ht
      FROM quotes
      WHERE UPPER(status) NOT IN ('CONVERTI', 'REFUSE', 'EXPIRE', 'EXPIRED', 'REJECTED', 'DRAFT', 'BROUILLON', 'INVOICED', 'ARCHIVED', 'CANCELLED')
        AND deletedAt IS NULL
        AND (validUntil IS NULL OR date(validUntil) >= date('now'))
        ${tf.sql}
    `;
    const params: unknown[] = [...tf.params];
    if (role !== ROLES.ADMIN) {
      query += ' AND created_by = ?';
      params.push(userId);
    }
    const row = db.prepare(query).get(...params) as { count: number; ttc: number; ht: number } | undefined;
    return {
      count: row?.count ?? 0,
      ttc: row?.ttc ?? 0,
      ht: row?.ht ?? 0,
    };
  }
};
