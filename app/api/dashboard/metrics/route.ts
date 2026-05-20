import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    // 1. Total Revenue (sum of all payments)
    const totalRevenueRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments").get() as any;
    const totalRevenue = totalRevenueRow.total;

    // 2. Growth calculation (Current Month vs Previous Month)
    const currentMonthRevRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments 
      WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
    `).get() as any;
    
    const lastMonthRevRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments 
      WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now', '-1 month')
    `).get() as any;

    const growth = lastMonthRevRow.total > 0
      ? ((currentMonthRevRow.total - lastMonthRevRow.total) / lastMonthRevRow.total * 100).toFixed(1)
      : (currentMonthRevRow.total > 0 ? "100.0" : "0.0");

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
    const activeInvoicesCountRow = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE deletedAt IS NULL").get() as any;
    const totalInvoicesCount = activeInvoicesCountRow.count;
    const paidCount = paidCountRow.count;

    // 6. Monthly Revenue Data (for 12 months of the current year)
    const months = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
    const revenueData = months.map((m, i) => {
      const monthStr = String(i + 1).padStart(2, '0');
      const row = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM payments 
        WHERE strftime('%Y', date) = strftime('%Y', 'now') 
        AND strftime('%m', date) = ?
      `).get(monthStr) as any;
      return { month: m, revenue: row.total };
    });

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
        totalInvoicesCount
      },
      revenueData,
      paymentMethodData,
      recentInvoices,
      activityTimeline
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to compute dashboard metrics' }, { status: 500 });
  }
}
