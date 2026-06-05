import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { dashboardMetricsQuerySchema } from '@/lib/validations';
import type { DashboardMetricsResponse, DashboardQueryParams, ErrorResponse, DbTotal, DbCount } from '@/lib/types/api';

export async function GET(request: Request) {
  try {
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
    const totalRevenueRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE ${dateFilter} AND deletedAt IS NULL`).get() as DbTotal;
    const totalRevenue = totalRevenueRow.total;

    // 2. Growth calculation
    const currentRevRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE ${dateFilter} AND deletedAt IS NULL`).get() as DbTotal;
    const prevRevRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE ${prevDateFilter} AND deletedAt IS NULL`).get() as DbTotal;

    const growth = prevRevRow.total > 0
      ? ((currentRevRow.total - prevRevRow.total) / prevRevRow.total * 100).toFixed(1)
      : (currentRevRow.total > 0 ? "100.0" : "0.0");

    // 3. Pending Revenue (Sum of remaining totals of active invoices, exclude soft-deleted payments)
    const pendingRevenueRow = db.prepare(`
      SELECT COALESCE(SUM(total - (
        SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoiceId = invoices.id AND deletedAt IS NULL
      )), 0) as total
      FROM invoices
      WHERE status IN ('UNPAID', 'PARTIALLY_PAID') AND deletedAt IS NULL
    `).get() as DbTotal;
    const pendingRevenue = pendingRevenueRow.total;

    // 4. Overdue Revenue
    const overdueRevenueRow = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total FROM invoices
      WHERE status = 'overdue' AND deletedAt IS NULL
    `).get() as DbTotal;
    const overdueRevenue = overdueRevenueRow.total;

    // 5. Total active invoices, paid invoices count, and paid invoices ratio
    const paidCountRow = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'PAID' AND deletedAt IS NULL").get() as DbCount;
    const unpaidCountRow = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'UNPAID' AND deletedAt IS NULL").get() as DbCount;
    const partiallyPaidCountRow = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'PARTIALLY_PAID' AND deletedAt IS NULL").get() as DbCount;
    const activeInvoicesCountRow = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE deletedAt IS NULL AND status != 'cancelled'").get() as DbCount;
    const totalInvoicesCount = activeInvoicesCountRow.count;
    const paidCount = paidCountRow.count;
    const unpaidCount = unpaidCountRow.count;
    const partiallyPaidCount = partiallyPaidCountRow.count;

    // 5b. Pending Quotes (quotes not converted to invoices)
    const pendingQuotesCountRow = db.prepare("SELECT COUNT(*) as count FROM quotes WHERE status NOT IN ('invoiced', 'archived') AND deletedAt IS NULL").get() as DbCount;
    const pendingQuotesCount = pendingQuotesCountRow.count;

    // 5c. Top Clients by revenue (exclude cancelled invoices)
    const topClients = db.prepare(`
      SELECT clientName, SUM(total) as totalRevenue
      FROM invoices
      WHERE deletedAt IS NULL AND status != 'cancelled'
      GROUP BY clientName
      ORDER BY totalRevenue DESC
      LIMIT 5
    `).all() as Array<{ clientName: string; totalRevenue: number }>;

    // 5d. User Performance (for Admin, exclude cancelled invoices)
    const userPerformance = db.prepare(`
      SELECT u.name,
             COUNT(i.id) as docsCount,
             COALESCE(SUM(i.total), 0) as totalRevenue
      FROM users u
      LEFT JOIN invoices i ON i.created_by = u.id AND i.deletedAt IS NULL AND i.status != 'cancelled'
      WHERE u.role = 'user'
      GROUP BY u.id, u.name
    `).all() as Array<{ name: string; docsCount: number; totalRevenue: number }>;

    // 6. Dynamic Revenue Data based on range
    let revenueData: Array<{ date: string; revenue: number }> = [];
    if (validatedRange === 'month') {
      // Last 30 days
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const row = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE date = ? AND deletedAt IS NULL").get(dateStr) as DbTotal;
        revenueData.push({ date: dateStr, revenue: row.total });
      }
    } else {
      // Monthly for current year
      const months = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
      revenueData = months.map((m, i) => {
        const monthStr = String(i + 1).padStart(2, '0');
        const row = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total FROM payments
          WHERE strftime('%Y', date) = strftime('%Y', 'now')
          AND strftime('%m', date) = ?
          AND deletedAt IS NULL
        `).get(monthStr) as DbTotal;
        return { date: `${i + 1}/${new Date().getFullYear()}`, revenue: row.total };
      });
    }

    // 7. Payment methods distribution percentages (exclude soft-deleted payments)
    const totalPaymentsCountRow = db.prepare("SELECT COUNT(*) as count FROM payments WHERE deletedAt IS NULL").get() as DbCount;
    const totalPaymentsCount = totalPaymentsCountRow.count || 1;

    const paymentMethodData = [
      { name: "Airtel Money", key: "airtel", color: "#ef4444" },
      { name: "Moov Money", key: "moov", color: "#3b82f6" },
      { name: "Virement", key: "virement", color: "#10b981" },
      { name: "Autre/Cash", key: "cash", color: "#64748b" },
    ].map(m => {
      const countRow = db.prepare("SELECT COUNT(*) as count FROM payments WHERE paymentMethod = ? AND deletedAt IS NULL").get(m.key) as DbCount;
      return {
        method: m.name,
        amount: Math.round((countRow.count / totalPaymentsCount) * 100),
      };
    }).filter(m => m.amount > 0);

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
