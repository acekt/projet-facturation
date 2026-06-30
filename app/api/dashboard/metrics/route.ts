import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/api/auth';
import { dashboardMetricsQuerySchema } from '@/lib/validations';
import type { DashboardMetricsResponse, DashboardQueryParams, ErrorResponse, DbTotal, DbCount } from '@/lib/types/api';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(session.userId) as { id: string; role: 'admin' | 'user' } | undefined;
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const isOperator = user.role === 'user';
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'month';

    // Validate query params with Zod
    const validation = dashboardMetricsQuerySchema.safeParse({ range });
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Paramètres de requête invalides',
        details: {
          fieldErrors: validation.error.flatten().fieldErrors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { range: validatedRange }: DashboardQueryParams = validation.data;

    let dateFilter = "strftime('%Y-%m', date) = strftime('%Y-%m', 'now')";
    let prevDateFilter = "strftime('%Y-%m', date) = strftime('%Y-%m', 'now', '-1 month')";

    if (validatedRange === 'quarter') {
      dateFilter = "date >= date('now', '-3 months')";
      prevDateFilter = "date >= date('now', '-6 months') AND date < date('now', '-3 months')";
    } else if (validatedRange === 'year') {
      dateFilter = "strftime('%Y', date) = strftime('%Y', 'now')";
      prevDateFilter = "strftime('%Y', date) = strftime('%Y', 'now', '-1 year')";
    }

    // 1. Total Revenue within range (exclude soft-deleted payments)
    const totalRevenueRow = db.prepare(`
      SELECT ROUND(COALESCE(SUM(p.amount), 0), 0) as total 
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE ${dateFilter.replace(/date/g, 'p.date')} AND p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status = 'PAID'
      ${isOperator ? 'AND i.created_by = ?' : ''}
    `).get(isOperator ? [userId] : []) as DbTotal;
    const totalRevenue = totalRevenueRow.total;

    // 2. Growth calculation
    const currentRevRow = db.prepare(`
      SELECT ROUND(COALESCE(SUM(p.amount), 0), 0) as total 
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE ${dateFilter.replace(/date/g, 'p.date')} AND p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status = 'PAID'
      ${isOperator ? 'AND i.created_by = ?' : ''}
    `).get(isOperator ? [userId] : []) as DbTotal;
    
    const prevRevRow = db.prepare(`
      SELECT ROUND(COALESCE(SUM(p.amount), 0), 0) as total 
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE ${prevDateFilter.replace(/date/g, 'p.date')} AND p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status = 'PAID'
      ${isOperator ? 'AND i.created_by = ?' : ''}
    `).get(isOperator ? [userId] : []) as DbTotal;

    const growth = prevRevRow.total > 0
      ? ((currentRevRow.total - prevRevRow.total) / prevRevRow.total * 100).toFixed(1)
      : (currentRevRow.total > 0 ? "100.0" : "0.0");

    // Yield to Event Loop
    await new Promise(resolve => setImmediate(resolve));

    // 3. Pending Revenue (Sum of remaining totals of active invoices, exclude soft-deleted payments)
    const pendingRevenueRow = db.prepare(`
      SELECT ROUND(COALESCE(SUM(total - (
        SELECT ROUND(COALESCE(SUM(amount), 0), 0) FROM payments WHERE invoiceId = invoices.id AND deletedAt IS NULL
      )), 0), 0) as total
      FROM invoices
      WHERE status IN ('UNPAID', 'PARTIALLY_PAID') AND deletedAt IS NULL
      ${isOperator ? 'AND created_by = ?' : ''}
    `).get(isOperator ? [userId] : []) as DbTotal;
    const pendingRevenue = pendingRevenueRow.total;

    // 4. Overdue Revenue
    const overdueRevenueRow = db.prepare(`
      SELECT ROUND(COALESCE(SUM(total), 0), 0) as total FROM invoices
      WHERE status = 'overdue' AND deletedAt IS NULL
      ${isOperator ? 'AND created_by = ?' : ''}
    `).get(isOperator ? [userId] : []) as DbTotal;
    const overdueRevenue = overdueRevenueRow.total;

    // 5. Total active invoices, paid invoices count, and paid invoices ratio
    const paidCountRow = db.prepare(`SELECT COUNT(*) as count FROM invoices WHERE status = 'PAID' AND deletedAt IS NULL ${isOperator ? 'AND created_by = ?' : ''}`).get(isOperator ? [userId] : []) as DbCount;
    const unpaidCountRow = db.prepare(`SELECT COUNT(*) as count FROM invoices WHERE status = 'UNPAID' AND deletedAt IS NULL ${isOperator ? 'AND created_by = ?' : ''}`).get(isOperator ? [userId] : []) as DbCount;
    const partiallyPaidCountRow = db.prepare(`SELECT COUNT(*) as count FROM invoices WHERE status = 'PARTIALLY_PAID' AND deletedAt IS NULL ${isOperator ? 'AND created_by = ?' : ''}`).get(isOperator ? [userId] : []) as DbCount;
    const activeInvoicesCountRow = db.prepare(`SELECT COUNT(*) as count FROM invoices WHERE deletedAt IS NULL AND status != 'cancelled' ${isOperator ? 'AND created_by = ?' : ''}`).get(isOperator ? [userId] : []) as DbCount;
    const totalInvoicesCount = activeInvoicesCountRow.count;
    const paidCount = paidCountRow.count;
    const unpaidCount = unpaidCountRow.count;
    const partiallyPaidCount = partiallyPaidCountRow.count;

    // Yield to Event Loop
    await new Promise(resolve => setImmediate(resolve));

    // 5b. Pending Quotes (quotes not converted to invoices)
    const pendingQuotesCountRow = db.prepare(`SELECT COUNT(*) as count FROM quotes WHERE status NOT IN ('invoiced', 'archived') AND deletedAt IS NULL ${isOperator ? 'AND created_by = ?' : ''}`).get(isOperator ? [userId] : []) as DbCount;
    const pendingQuotesCount = pendingQuotesCountRow.count;

    // 5c. Top Clients by revenue (exclude cancelled invoices)
    const topClients = db.prepare(`
      SELECT clientName, SUM(total) as totalRevenue
      FROM invoices
      WHERE deletedAt IS NULL AND status != 'cancelled'
      ${isOperator ? 'AND created_by = ?' : ''}
      GROUP BY clientName
      ORDER BY totalRevenue DESC
      LIMIT 5
    `).all(isOperator ? [userId] : []) as Array<{ clientName: string; totalRevenue: number }>;

    // 5d. User Performance (for Admin, exclude cancelled invoices)
    const userPerformance = isOperator ? [] : db.prepare(`
      SELECT u.name,
             COUNT(i.id) as docsCount,
             ROUND(COALESCE(SUM(i.total), 0), 0) as totalRevenue
     FROM users u
     LEFT JOIN invoices i ON i.created_by = u.id AND i.deletedAt IS NULL AND i.status != 'cancelled'
     WHERE u.role = 'user'
     GROUP BY u.id, u.name
    `).all() as Array<{ name: string; docsCount: number; totalRevenue: number }>;

    // Yield to Event Loop
    await new Promise(resolve => setImmediate(resolve));

    // 6. Dynamic Revenue Data based on range (Optimized single database queries)
    let revenueData: Array<{ date: string; revenue: number; label: string; value: number }> = [];
    if (validatedRange === 'month') {
      // Last 30 days - optimized single query grouping by date
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 29);
      const startDateStr = startDate.toISOString().split('T')[0];

      const paymentsGrouped = db.prepare(`
        SELECT p.date, ROUND(SUM(p.amount), 0) as total 
        FROM payments p
        JOIN invoices i ON p.invoiceId = i.id
        WHERE p.date >= ? AND p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status = 'PAID'
        ${isOperator ? 'AND i.created_by = ?' : ''}
        GROUP BY p.date
      `).all(isOperator ? [startDateStr, userId] : [startDateStr]) as Array<{ date: string; total: number }>;

      const paymentsMap = new Map(paymentsGrouped.map(p => [p.date, p.total]));

      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const revenue = paymentsMap.get(dateStr) || 0;
        
        // Format date label (e.g., "08 juin")
        const label = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        
        revenueData.push({
          date: dateStr,
          revenue,
          label,
          value: revenue
        });
      }
    } else {
      // Monthly for current year - optimized single query grouping by month
      const paymentsGrouped = db.prepare(`
        SELECT strftime('%m', p.date) as monthStr, ROUND(SUM(p.amount), 0) as total 
        FROM payments p
        JOIN invoices i ON p.invoiceId = i.id
        WHERE strftime('%Y', p.date) = strftime('%Y', 'now') AND p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status = 'PAID'
        ${isOperator ? 'AND i.created_by = ?' : ''}
        GROUP BY monthStr
      `).all(isOperator ? [userId] : []) as Array<{ monthStr: string; total: number }>;

      const paymentsMap = new Map(paymentsGrouped.map(p => [p.monthStr, p.total]));

      const months = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
      revenueData = months.map((m, i) => {
        const monthStr = String(i + 1).padStart(2, '0');
        const revenue = paymentsMap.get(monthStr) || 0;
        return {
          date: `${i + 1}/${new Date().getFullYear()}`,
          revenue,
          label: m,
          value: revenue
        };
      });
    }

    // Yield to Event Loop
    await new Promise(resolve => setImmediate(resolve));

    const totalPaymentsCountRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status = 'PAID'
      ${isOperator ? 'AND i.created_by = ?' : ''}
    `).get(isOperator ? [userId] : []) as DbCount;
    const totalPaymentsCount = totalPaymentsCountRow.count || 1;

    const paymentsGroupedByMethod = db.prepare(`
      SELECT p.paymentMethod, COUNT(*) as count 
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status = 'PAID'
      ${isOperator ? 'AND i.created_by = ?' : ''}
      GROUP BY p.paymentMethod
    `).all(isOperator ? [userId] : []) as Array<{ paymentMethod: string; count: number }>;

    const paymentCountsMap = new Map(paymentsGroupedByMethod.map(p => [p.paymentMethod, p.count]));

    const paymentMethodData = [
      { name: "Airtel Money", key: "Airtel Money" },
      { name: "Moov Money", key: "Moov Money" },
      { name: "Virement", key: "Virement Bancaire" },
      { name: "Espèces", key: "Espèces" },
      { name: "Chèque", key: "Chèque" },
    ].map(m => {
      const count = paymentCountsMap.get(m.key) || 0;
      return {
        method: m.name,
        amount: Math.round((count / totalPaymentsCount) * 100),
      };
    }).filter(m => m.amount > 0);

    // 8. Recent activity timeline from audit logs
    const recentLogs = db.prepare(`
      SELECT id, action, details, createdAt, userName
      FROM audit_logs
      ${isOperator ? 'WHERE userId = ?' : ''}
      ORDER BY createdAt DESC
      LIMIT 5
    `).all(isOperator ? [userId] : []) as Array<{ id: string; action: string; details: string; createdAt: string; userName: string | null }>;

    const activityTimeline = recentLogs.map(log => {
      const dateVal = new Date(log.createdAt);
      // Format time as "HH:MM DD/MM"
      const timeStr = dateVal.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      }) + ' ' + dateVal.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit'
      });

      return {
        id: log.id,
        action: log.details || log.action,
        client: log.userName || 'Système',
        time: timeStr
      };
    });

    const response: DashboardMetricsResponse = {
      totalRevenue,
      growth,
      pendingRevenue,
      overdueRevenue,
      paidCount,
      unpaidCount,
      partiallyPaidCount,
      totalInvoicesCount,
      pendingQuotesCount,
      topClients,
      userPerformance,
      revenueData,
      paymentMethodData,
      activityTimeline,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Dashboard Metrics API Error]', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to compute dashboard metrics',
      details: {
        message: error instanceof Error ? error.message : String(error),
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
