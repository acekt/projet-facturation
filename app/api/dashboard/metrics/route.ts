import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'month';

    let dateFilter = "strftime('%Y-%m', date) = strftime('%Y-%m', 'now')";
    let prevDateFilter = "strftime('%Y-%m', date) = strftime('%Y-%m', 'now', '-1 month')";

    if (range === 'quarter') {
      dateFilter = "date >= date('now', '-3 months')";
      prevDateFilter = "date >= date('now', '-6 months') AND date < date('now', '-3 months')";
    } else if (range === 'year') {
      dateFilter = "strftime('%Y', date) = strftime('%Y', 'now')";
      prevDateFilter = "strftime('%Y', date) = strftime('%Y', 'now', '-1 year')";
    }

    // 1. Total Revenue within range
    const totalRevenueRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE ${dateFilter}`).get() as any;
    const totalRevenue = totalRevenueRow.total;

    // 2. Growth calculation
    const currentRevRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE ${dateFilter}`).get() as any;
    const prevRevRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE ${prevDateFilter}`).get() as any;

    const growth = prevRevRow.total > 0
      ? ((currentRevRow.total - prevRevRow.total) / prevRevRow.total * 100).toFixed(1)
      : (currentRevRow.total > 0 ? "100.0" : "0.0");

    // 3. Pending Revenue (Sum of remaining totals of active invoices)
    const pendingRevenueRow = db.prepare(`
      SELECT COALESCE(SUM(total - (
        SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoiceId = invoices.id
      )), 0) as total
      FROM invoices
      WHERE status IN ('UNPAID', 'PARTIALLY_PAID') AND deletedAt IS NULL
    `).get() as any;
    const pendingRevenue = pendingRevenueRow.total;

    // 4. Overdue Revenue
    const overdueRevenueRow = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total FROM invoices
      WHERE status = 'overdue' AND deletedAt IS NULL
    `).get() as any;
    const overdueRevenue = overdueRevenueRow.total;

    // 5. Total active invoices, paid invoices count, and paid invoices ratio
    const paidCountRow = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'PAID' AND deletedAt IS NULL").get() as any;
    const unpaidCountRow = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'UNPAID' AND deletedAt IS NULL").get() as any;
    const partiallyPaidCountRow = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'PARTIALLY_PAID' AND deletedAt IS NULL").get() as any;
    const activeInvoicesCountRow = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE deletedAt IS NULL AND status != 'cancelled'").get() as any;
    const totalInvoicesCount = activeInvoicesCountRow.count;
    const paidCount = paidCountRow.count;
    const unpaidCount = unpaidCountRow.count;
    const partiallyPaidCount = partiallyPaidCountRow.count;

    // 5b. Pending Quotes (quotes not converted to invoices)
    const pendingQuotesCountRow = db.prepare("SELECT COUNT(*) as count FROM quotes WHERE status NOT IN ('invoiced', 'archived') AND deletedAt IS NULL").get() as any;
    const pendingQuotesCount = pendingQuotesCountRow.count;

    // 5c. Top Clients by revenue (exclude cancelled invoices)
    const topClients = db.prepare(`
      SELECT clientName, SUM(total) as totalRevenue
      FROM invoices
      WHERE deletedAt IS NULL AND status != 'cancelled'
      GROUP BY clientName
      ORDER BY totalRevenue DESC
      LIMIT 5
    `).all() as any[];

    // 5d. User Performance (for Admin, exclude cancelled invoices)
    const userPerformance = db.prepare(`
      SELECT u.name,
             COUNT(i.id) as docsCount,
             COALESCE(SUM(i.total), 0) as totalRevenue
      FROM users u
      LEFT JOIN invoices i ON i.created_by = u.id AND i.deletedAt IS NULL AND i.status != 'cancelled'
      WHERE u.role = 'user'
      GROUP BY u.id, u.name
    `).all() as any[];

    // 6. Dynamic Revenue Data based on range
    let revenueData = [];
    if (range === 'month') {
      // Last 30 days
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const row = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE date = ?").get(dateStr) as any;
        revenueData.push({ label: date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }), value: row.total });
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
        `).get(monthStr) as any;
        return { label: m, value: row.total };
      });
    }

    // 7. Payment methods distribution percentages
    const totalPaymentsCountRow = db.prepare("SELECT COUNT(*) as count FROM payments").get() as any;
    const totalPaymentsCount = totalPaymentsCountRow.count || 1;

    const paymentMethodData = [
      { name: "Airtel Money", key: "airtel", color: "#ef4444" },
      { name: "Moov Money", key: "moov", color: "#3b82f6" },
      { name: "Virement", key: "virement", color: "#10b981" },
      { name: "Autre/Cash", key: "cash", color: "#64748b" },
    ].map(m => {
      const countRow = db.prepare("SELECT COUNT(*) as count FROM payments WHERE paymentMethod = ?").get(m.key) as any;
      return {
        name: m.name,
        value: Math.round((countRow.count / totalPaymentsCount) * 100),
        color: m.color
      };
    }).filter(m => m.value > 0);

    // 8. Recent Invoices
    const recentInvoices = db.prepare(`
      SELECT * FROM invoices
      WHERE deletedAt IS NULL
      ORDER BY date DESC LIMIT 5
    `).all() as any[];

    // 9. Activity Timeline (UNION of recent active quotes & invoices)
    const quotesList = db.prepare("SELECT id, status, clientName, date FROM quotes WHERE deletedAt IS NULL ORDER BY date DESC LIMIT 5").all() as any[];
    const invoicesList = db.prepare("SELECT id, status, clientName, date FROM invoices WHERE deletedAt IS NULL ORDER BY date DESC LIMIT 5").all() as any[];

    const activityTimeline = [
      ...quotesList.map(q => ({
        id: q.id,
        action: q.status === 'invoiced' ? "Devis converti" : "Nouveau devis",
        client: q.clientName,
        time: q.date,
        type: "send"
      })),
      ...invoicesList.map(i => ({
        id: i.id,
        action: i.status === 'PAID' ? "Facture payée" : i.status === 'PARTIALLY_PAID' ? "Acompte reçu" : "Facture émise",
        client: i.clientName,
        time: i.date,
        type: "payment"
      }))
    ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 5);

    return NextResponse.json({
      metrics: {
        totalRevenue,
        growth: parseFloat(growth),
        pendingRevenue,
        overdueRevenue,
        paidCount,
        unpaidCount,
        partiallyPaidCount,
        totalInvoicesCount,
        pendingQuotesCount
      },
      revenueData,
      paymentMethodData,
      recentInvoices,
      activityTimeline,
      topClients,
      userPerformance
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to compute dashboard metrics' }, { status: 500 });
  }
}
