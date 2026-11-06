"use server";

import db from '@/lib/db';
import { MetricsRepository } from '@/lib/repositories/MetricsRepository';
import { getSession } from '@/lib/api/auth';
import { resolveActiveTenantId } from '@/lib/api/tenant';
import { dashboardMetricsQuerySchema } from '@/lib/validations';
import type { DashboardMetricsResponse, DashboardQueryParams, CashflowPoint } from '@/lib/types/api';
import type { ActionResponse } from '@/lib/types/api';
import { formatAuditShortDateTimeFr, formatAuditDetails, cleanDocumentNumbersInText } from '@/lib/utils/auditFormatter';

export async function getDashboardMetrics(range: string = 'month'): Promise<ActionResponse<DashboardMetricsResponse>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Non authentifié' };

    const user = db.prepare('SELECT id FROM users WHERE id = ? AND deletedAt IS NULL').get(session.userId);
    if (!user) return { success: false, error: 'Utilisateur introuvable' };

    const validation = dashboardMetricsQuerySchema.safeParse({ range });
    if (!validation.success) {
      return { success: false, error: 'Paramètres invalides' };
    }

    const { range: validatedRange }: DashboardQueryParams = validation.data;
    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);

    let pDateFilter = "p.date >= date('now', '-30 days')";
    let pPrevDateFilter = "p.date >= date('now', '-60 days') AND p.date < date('now', '-30 days')";
    let iDateFilter = "i.date >= date('now', '-30 days')";

    if (validatedRange === 'quarter') {
      pDateFilter = "p.date >= date('now', '-3 months')";
      pPrevDateFilter = "p.date >= date('now', '-6 months') AND p.date < date('now', '-3 months')";
      iDateFilter = "i.date >= date('now', '-3 months')";
    } else if (validatedRange === 'year') {
      pDateFilter = "strftime('%Y', p.date) = strftime('%Y', 'now')";
      pPrevDateFilter = "strftime('%Y', p.date) = strftime('%Y', 'now', '-1 year')";
      iDateFilter = "strftime('%Y', i.date) = strftime('%Y', 'now')";
    } else if (validatedRange === 'all') {
      pDateFilter = "1=1";
      pPrevDateFilter = "1=0";
      iDateFilter = "1=1";
    }

    const totalRevenue = MetricsRepository.getTotalRevenue(session.userId, session.role, pDateFilter, activeTenantId);
    const currentRevTotal = totalRevenue;
    const prevRevTotal = MetricsRepository.getTotalRevenue(session.userId, session.role, pPrevDateFilter, activeTenantId);

    const growth = prevRevTotal > 0
      ? ((currentRevTotal - prevRevTotal) / prevRevTotal * 100).toFixed(1)
      : (currentRevTotal > 0 ? "100.0" : "0.0");

    const pendingRevenue = MetricsRepository.getPendingRevenue(session.userId, session.role, iDateFilter, activeTenantId);
    const overdueRevenue = MetricsRepository.getOverdueRevenue(session.userId, session.role, activeTenantId);

    const counts = MetricsRepository.getInvoiceCounts(session.userId, session.role, validatedRange, activeTenantId);
    const quotesPipeline = MetricsRepository.getQuotesPipelineDetails(session.userId, session.role, activeTenantId);
    const topClients = MetricsRepository.getTopClients(session.userId, session.role, activeTenantId);
    const userPerformance = MetricsRepository.getUserPerformance(session.role, activeTenantId);

    // 1. Indicateurs Livre des Comptes (ledgerSummary)
    const ledgerSummary = MetricsRepository.getLedgerSummary(session.userId, session.role, pDateFilter, activeTenantId);

    // 2. Prévisions Financières & Ratios (forecastMetrics)
    const forecastMetrics = MetricsRepository.getForecastMetrics(
      session.userId,
      session.role,
      ledgerSummary.netTreasury,
      ledgerSummary.averageMonthlyExpenses,
      totalRevenue,
      pendingRevenue,
      activeTenantId
    );

    // 3. Indicateurs Gestion de Stock (stockMetrics)
    const stockMetrics = MetricsRepository.getStockMetrics(session.userId, session.role, activeTenantId);

    // 4. Séries Temporelles Comparatives (revenueData & cashflowSeries)
    let revenueData: Array<{ date: string; revenue: number; label: string; value: number }> = [];
    let cashflowSeries: Array<CashflowPoint> = [];

    if (validatedRange === 'month') {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 29);
      const startDateStr = startDate.toISOString().split('T')[0];

      const paymentsGrouped = MetricsRepository.getDailyRevenueGrouped(session.userId, session.role, startDateStr, activeTenantId);
      const paymentsMap = new Map(paymentsGrouped.map(p => [p.date, p.total]));

      const ledgerGrouped = MetricsRepository.getDailyLedgerGrouped(startDateStr, activeTenantId);
      const ledgerInMap = new Map(ledgerGrouped.map(l => [l.date, l.income]));
      const ledgerOutMap = new Map(ledgerGrouped.map(l => [l.date, l.expense]));

      const invoicedGrouped = MetricsRepository.getDailyInvoicedGrouped(startDateStr, activeTenantId);
      const invoicedMap = new Map(invoicedGrouped.map(inv => [inv.date, inv.total]));

      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const pRev = paymentsMap.get(dateStr) || 0;
        const lIn = ledgerInMap.get(dateStr) || 0;
        const income = Math.max(lIn, pRev);
        const expense = ledgerOutMap.get(dateStr) || 0;
        const billedRev = invoicedMap.get(dateStr) || 0;
        const label = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

        revenueData.push({ date: dateStr, revenue: income, label, value: income });
        cashflowSeries.push({
          date: dateStr,
          label,
          income,
          expense,
          revenue: billedRev,
        });
      }
    } else if (validatedRange === 'quarter') {
      const paymentsGrouped = MetricsRepository.getMonthlyRevenueGrouped(session.userId, session.role, activeTenantId);
      const paymentsMap = new Map(paymentsGrouped.map(p => [p.monthStr, p.total]));

      const ledgerGrouped = MetricsRepository.getMonthlyLedgerGrouped(activeTenantId);
      const ledgerInMap = new Map(ledgerGrouped.map(l => [l.monthStr, l.income]));
      const ledgerOutMap = new Map(ledgerGrouped.map(l => [l.monthStr, l.expense]));

      const invoicedGrouped = MetricsRepository.getMonthlyInvoicedGrouped(activeTenantId);
      const invoicedMap = new Map(invoicedGrouped.map(inv => [inv.monthStr, inv.total]));

      const now = new Date();
      const currentMonthIndex = now.getMonth();
      const quarterStartMonth = Math.floor(currentMonthIndex / 3) * 3;
      const allMonths = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

      [0, 1, 2].forEach((offset) => {
        const mIndex = quarterStartMonth + offset;
        const monthStr = String(mIndex + 1).padStart(2, '0');
        const pRev = paymentsMap.get(monthStr) || 0;
        const lIn = ledgerInMap.get(monthStr) || 0;
        const income = Math.max(lIn, pRev);
        const expense = ledgerOutMap.get(monthStr) || 0;
        const billedRev = invoicedMap.get(monthStr) || 0;
        const label = allMonths[mIndex];
        const dateKey = `${mIndex + 1}/${now.getFullYear()}`;

        revenueData.push({
          date: dateKey,
          revenue: income,
          label,
          value: income,
        });

        cashflowSeries.push({
          date: dateKey,
          label,
          income,
          expense,
          revenue: billedRev,
        });
      });
    } else {
      const paymentsGrouped = MetricsRepository.getMonthlyRevenueGrouped(session.userId, session.role, activeTenantId);
      const paymentsMap = new Map(paymentsGrouped.map(p => [p.monthStr, p.total]));

      const ledgerGrouped = MetricsRepository.getMonthlyLedgerGrouped(activeTenantId);
      const ledgerInMap = new Map(ledgerGrouped.map(l => [l.monthStr, l.income]));
      const ledgerOutMap = new Map(ledgerGrouped.map(l => [l.monthStr, l.expense]));

      const invoicedGrouped = MetricsRepository.getMonthlyInvoicedGrouped(activeTenantId);
      const invoicedMap = new Map(invoicedGrouped.map(inv => [inv.monthStr, inv.total]));

      const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
      months.forEach((m, i) => {
        const monthStr = String(i + 1).padStart(2, '0');
        const pRev = paymentsMap.get(monthStr) || 0;
        const lIn = ledgerInMap.get(monthStr) || 0;
        const income = Math.max(lIn, pRev);
        const expense = ledgerOutMap.get(monthStr) || 0;
        const billedRev = invoicedMap.get(monthStr) || 0;
        const dateKey = `${i + 1}/${new Date().getFullYear()}`;

        revenueData.push({
          date: dateKey,
          revenue: income,
          label: m,
          value: income,
        });

        cashflowSeries.push({
          date: dateKey,
          label: m,
          income,
          expense,
          revenue: billedRev,
        });
      });
    }

    const { totalCount, methods } = MetricsRepository.getPaymentMethodDistribution(session.userId, session.role, activeTenantId);
    const paymentCountsMap = new Map(methods.map(p => [p.paymentMethod, p.count]));
    const paymentMethodData = [
      { name: "Airtel Money", key: "Airtel Money" },
      { name: "Moov Money", key: "Moov Money" },
      { name: "Virement", key: "Virement Bancaire" },
      { name: "Espèces", key: "Espèces" },
      { name: "Chèque", key: "Chèque" },
    ].map(m => {
      const count = paymentCountsMap.get(m.key) || 0;
      return { method: m.name, amount: Math.round((count / totalCount) * 100) };
    }).filter(m => m.amount > 0);

    const recentLogs = MetricsRepository.getRecentActivity(session.userId, session.role, activeTenantId);
    const activityTimeline = recentLogs.map(log => {
      const timeStr = formatAuditShortDateTimeFr(log.createdAt);
      let humanAction = log.action;
      if (log.details) {
        try {
          const parsed = JSON.parse(log.details);
          if (parsed.action === 'FIRST_RUN_SETUP') {
            humanAction = `Initialisation de l'espace (${parsed.companyName || 'Structure'})`;
          } else {
            humanAction = formatAuditDetails(log.details).humanText;
          }
        } catch {
          humanAction = formatAuditDetails(log.details).humanText;
        }
      }
      humanAction = cleanDocumentNumbersInText(humanAction);
      return { id: log.id, action: humanAction, client: log.userName || 'Système', time: timeStr };
    });

    const response: DashboardMetricsResponse = {
      totalRevenue,
      growth,
      pendingRevenue,
      overdueRevenue,
      ...counts,
      pendingQuotesCount: quotesPipeline.count,
      topClients,
      userPerformance,
      revenueData,
      paymentMethodData,
      activityTimeline,
      ledgerSummary,
      cashflowSeries,
      forecastMetrics,
      stockMetrics,
      quotesPipelineAmount: quotesPipeline,
    };

    return { success: true, data: response };
  } catch (error) {
    console.error('[Action getDashboardMetrics] Error:', error);
    return { success: false, error: 'Failed to compute dashboard metrics' };
  }
}
