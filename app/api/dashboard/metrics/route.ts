import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/api/auth';
import { dashboardMetricsQuerySchema } from '@/lib/validations';
import type { DashboardMetricsResponse, DashboardQueryParams, ErrorResponse, DbTotal, DbCount } from '@/lib/types/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ? AND deletedAt IS NULL').get(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    console.log('--- DASHBOARD API CALL ---');
    console.log('Role:', session.role);
    console.log('UserId:', session.userId);

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
    let totalRevenueQuery = `
      SELECT COALESCE(ROUND(COALESCE(SUM(p.amount), 0), 0), 0) as total 
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE ${dateFilter.replace(/date/g, 'p.date')} AND p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('PAID', 'PARTIALLY_PAID')
    `;
    const totalRevenueParams: unknown[] = [];
    if (session.role !== 'admin') {
      totalRevenueQuery += ' AND i.created_by = ?';
      totalRevenueParams.push(session.userId);
    }
    const totalRevenueRow = db.prepare(totalRevenueQuery).get(...totalRevenueParams) as DbTotal | undefined;
    const totalRevenue = totalRevenueRow?.total ?? 0;

    // 2. Growth calculation
    let currentRevQuery = `
      SELECT COALESCE(ROUND(COALESCE(SUM(p.amount), 0), 0), 0) as total 
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE ${dateFilter.replace(/date/g, 'p.date')} AND p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('PAID', 'PARTIALLY_PAID')
    `;
    const currentRevParams: unknown[] = [];
    if (session.role !== 'admin') {
      currentRevQuery += ' AND i.created_by = ?';
      currentRevParams.push(session.userId);
    }
    const currentRevRow = db.prepare(currentRevQuery).get(...currentRevParams) as DbTotal | undefined;
    const currentRevTotal = currentRevRow?.total ?? 0;

    let prevRevQuery = `
      SELECT COALESCE(ROUND(COALESCE(SUM(p.amount), 0), 0), 0) as total 
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE ${prevDateFilter.replace(/date/g, 'p.date')} AND p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('PAID', 'PARTIALLY_PAID')
    `;
    const prevRevParams: unknown[] = [];
    if (session.role !== 'admin') {
      prevRevQuery += ' AND i.created_by = ?';
      prevRevParams.push(session.userId);
    }
    const prevRevRow = db.prepare(prevRevQuery).get(...prevRevParams) as DbTotal | undefined;
    const prevRevTotal = prevRevRow?.total ?? 0;

    const growth = prevRevTotal > 0
      ? ((currentRevTotal - prevRevTotal) / prevRevTotal * 100).toFixed(1)
      : (currentRevTotal > 0 ? "100.0" : "0.0");

    // Yield to Event Loop
    await new Promise(resolve => setImmediate(resolve));

    // 3. Pending Revenue (Sum of remaining totals of active invoices, exclude soft-deleted payments)
    let pendingRevenueQuery = `
      SELECT COALESCE(ROUND(COALESCE(SUM(total - (
        SELECT COALESCE(ROUND(COALESCE(SUM(amount), 0), 0), 0) FROM payments WHERE invoiceId = invoices.id AND deletedAt IS NULL
      )), 0), 0), 0) as total
      FROM invoices
      WHERE status IN ('UNPAID', 'PARTIALLY_PAID', 'overdue', 'EN_RETARD') AND deletedAt IS NULL
    `;
    const pendingRevenueParams: unknown[] = [];
    if (session.role !== 'admin') {
      pendingRevenueQuery += ' AND created_by = ?';
      pendingRevenueParams.push(session.userId);
    }
    const pendingRevenueRow = db.prepare(pendingRevenueQuery).get(...pendingRevenueParams) as DbTotal | undefined;
    const pendingRevenue = pendingRevenueRow?.total ?? 0;

    // 4. Overdue Revenue
    let overdueRevenueQuery = `
      SELECT COALESCE(ROUND(COALESCE(SUM(total), 0), 0), 0) as total FROM invoices
      WHERE status IN ('overdue', 'EN_RETARD') AND deletedAt IS NULL
    `;
    const overdueRevenueParams: unknown[] = [];
    if (session.role !== 'admin') {
      overdueRevenueQuery += ' AND created_by = ?';
      overdueRevenueParams.push(session.userId);
    }
    const overdueRevenueRow = db.prepare(overdueRevenueQuery).get(...overdueRevenueParams) as DbTotal | undefined;
    const overdueRevenue = overdueRevenueRow?.total ?? 0;

    // 5. Total active invoices, paid invoices count, and paid invoices ratio
    let paidCountQuery = "SELECT COUNT(*) as count FROM invoices WHERE status = 'PAID' AND deletedAt IS NULL";
    const paidCountParams: unknown[] = [];
    if (session.role !== 'admin') {
      paidCountQuery += ' AND created_by = ?';
      paidCountParams.push(session.userId);
    }
    const paidCountRow = db.prepare(paidCountQuery).get(...paidCountParams) as DbCount | undefined;

    let unpaidCountQuery = "SELECT COUNT(*) as count FROM invoices WHERE status = 'UNPAID' AND deletedAt IS NULL";
    const unpaidCountParams: unknown[] = [];
    if (session.role !== 'admin') {
      unpaidCountQuery += ' AND created_by = ?';
      unpaidCountParams.push(session.userId);
    }
    const unpaidCountRow = db.prepare(unpaidCountQuery).get(...unpaidCountParams) as DbCount | undefined;

    let partiallyPaidCountQuery = "SELECT COUNT(*) as count FROM invoices WHERE status = 'PARTIALLY_PAID' AND deletedAt IS NULL";
    const partiallyPaidCountParams: unknown[] = [];
    if (session.role !== 'admin') {
      partiallyPaidCountQuery += ' AND created_by = ?';
      partiallyPaidCountParams.push(session.userId);
    }
    const partiallyPaidCountRow = db.prepare(partiallyPaidCountQuery).get(...partiallyPaidCountParams) as DbCount | undefined;

    let activeInvoicesCountQuery = "SELECT COUNT(*) as count FROM invoices WHERE deletedAt IS NULL AND status != 'cancelled'";
    const activeInvoicesCountParams: unknown[] = [];
    if (session.role !== 'admin') {
      activeInvoicesCountQuery += ' AND created_by = ?';
      activeInvoicesCountParams.push(session.userId);
    }
    const activeInvoicesCountRow = db.prepare(activeInvoicesCountQuery).get(...activeInvoicesCountParams) as DbCount | undefined;

    const totalInvoicesCount = activeInvoicesCountRow?.count ?? 0;
    const paidCount = paidCountRow?.count ?? 0;
    const unpaidCount = unpaidCountRow?.count ?? 0;
    const partiallyPaidCount = partiallyPaidCountRow?.count ?? 0;

    // Yield to Event Loop
    await new Promise(resolve => setImmediate(resolve));

    // 5b. Pending Quotes (quotes not converted to invoices)
    let pendingQuotesCountQuery = "SELECT COUNT(*) as count FROM quotes WHERE status NOT IN ('CONVERTI', 'REFUSE', 'EXPIRE', 'invoiced', 'archived', 'cancelled') AND deletedAt IS NULL";
    const pendingQuotesCountParams: unknown[] = [];
    if (session.role !== 'admin') {
      pendingQuotesCountQuery += ' AND created_by = ?';
      pendingQuotesCountParams.push(session.userId);
    }
    const pendingQuotesCountRow = db.prepare(pendingQuotesCountQuery).get(...pendingQuotesCountParams) as DbCount | undefined;
    const pendingQuotesCount = pendingQuotesCountRow?.count ?? 0;

    // 5c. Top Clients by revenue (exclude cancelled invoices)
    let topClientsQuery = `
      SELECT clientName, COALESCE(ROUND(SUM(total), 0), 0) as totalRevenue
      FROM invoices
      WHERE deletedAt IS NULL AND status != 'cancelled'
    `;
    const topClientsParams: unknown[] = [];
    if (session.role !== 'admin') {
      topClientsQuery += ' AND created_by = ?';
      topClientsParams.push(session.userId);
    }
    topClientsQuery += `
      GROUP BY clientName
      ORDER BY totalRevenue DESC
      LIMIT 5
    `;
    const topClients = db.prepare(topClientsQuery).all(...topClientsParams) as Array<{ clientName: string; totalRevenue: number }>;

    // 5d. User Performance (for Admin, exclude cancelled invoices)
    const userPerformance = session.role !== 'admin' ? [] : db.prepare(`
      SELECT u.name,
             COUNT(i.id) as docsCount,
             COALESCE(ROUND(COALESCE(SUM(i.total), 0), 0), 0) as totalRevenue
     FROM users u
     LEFT JOIN invoices i ON i.created_by = u.id AND i.deletedAt IS NULL AND i.status != 'cancelled'
     WHERE u.role IN ('user', 'operator')
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

      let paymentsGroupedQuery = `
        SELECT p.date, COALESCE(ROUND(SUM(p.amount), 0), 0) as total 
        FROM payments p
        JOIN invoices i ON p.invoiceId = i.id
        WHERE p.date >= ? AND p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('PAID', 'PARTIALLY_PAID')
      `;
      const paymentsGroupedParams: unknown[] = [startDateStr];
      if (session.role !== 'admin') {
        paymentsGroupedQuery += ' AND i.created_by = ?';
        paymentsGroupedParams.push(session.userId);
      }
      paymentsGroupedQuery += ' GROUP BY p.date';

      const paymentsGrouped = db.prepare(paymentsGroupedQuery).all(...paymentsGroupedParams) as Array<{ date: string; total: number }>;

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
      let paymentsGroupedQuery = `
        SELECT strftime('%m', p.date) as monthStr, COALESCE(ROUND(SUM(p.amount), 0), 0) as total 
        FROM payments p
        JOIN invoices i ON p.invoiceId = i.id
        WHERE strftime('%Y', p.date) = strftime('%Y', 'now') AND p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('PAID', 'PARTIALLY_PAID')
      `;
      const paymentsGroupedParams: unknown[] = [];
      if (session.role !== 'admin') {
        paymentsGroupedQuery += ' AND i.created_by = ?';
        paymentsGroupedParams.push(session.userId);
      }
      paymentsGroupedQuery += ' GROUP BY monthStr';

      const paymentsGrouped = db.prepare(paymentsGroupedQuery).all(...paymentsGroupedParams) as Array<{ monthStr: string; total: number }>;

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

    let totalPaymentsCountQuery = `
      SELECT COUNT(*) as count 
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('PAID', 'PARTIALLY_PAID')
    `;
    const totalPaymentsCountParams: unknown[] = [];
    if (session.role !== 'admin') {
      totalPaymentsCountQuery += ' AND i.created_by = ?';
      totalPaymentsCountParams.push(session.userId);
    }
    const totalPaymentsCountRow = db.prepare(totalPaymentsCountQuery).get(...totalPaymentsCountParams) as DbCount | undefined;
    const totalPaymentsCount = totalPaymentsCountRow?.count || 1;

    let paymentsGroupedByMethodQuery = `
      SELECT p.paymentMethod, COUNT(*) as count 
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE p.deletedAt IS NULL AND i.deletedAt IS NULL AND i.status IN ('PAID', 'PARTIALLY_PAID')
    `;
    const paymentsGroupedByMethodParams: unknown[] = [];
    if (session.role !== 'admin') {
      paymentsGroupedByMethodQuery += ' AND i.created_by = ?';
      paymentsGroupedByMethodParams.push(session.userId);
    }
    paymentsGroupedByMethodQuery += ' GROUP BY p.paymentMethod';

    const paymentsGroupedByMethod = db.prepare(paymentsGroupedByMethodQuery).all(...paymentsGroupedByMethodParams) as Array<{ paymentMethod: string; count: number }>;

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
    let recentLogsQuery = `
      SELECT id, action, details, createdAt, userName
      FROM audit_logs
    `;
    const recentLogsParams: unknown[] = [];
    if (session.role !== 'admin') {
      recentLogsQuery += ' WHERE userId = ?';
      recentLogsParams.push(session.userId);
    }
    recentLogsQuery += `
      ORDER BY createdAt DESC
      LIMIT 5
    `;
    const recentLogs = db.prepare(recentLogsQuery).all(...recentLogsParams) as Array<{ id: string; action: string; details: string; createdAt: string; userName: string | null }>;

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

    const nextResponse = NextResponse.json(response);
    nextResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    nextResponse.headers.set('Pragma', 'no-cache');
    nextResponse.headers.set('Expires', '0');
    return nextResponse;
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
