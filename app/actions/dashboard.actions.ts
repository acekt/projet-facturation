"use server";

import db from '@/lib/db';
import { MetricsRepository } from '@/lib/repositories/MetricsRepository';
import { getSession } from '@/lib/api/auth';
import { dashboardMetricsQuerySchema } from '@/lib/validations';
import type { DashboardMetricsResponse, DashboardQueryParams } from '@/lib/types/api';
import type { ActionResponse } from './client.actions';

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

    let pDateFilter = "strftime('%Y-%m', p.date) = strftime('%Y-%m', 'now')";
    let pPrevDateFilter = "strftime('%Y-%m', p.date) = strftime('%Y-%m', 'now', '-1 month')";
    let iDateFilter = "strftime('%Y-%m', i.date) = strftime('%Y-%m', 'now')";

    if (validatedRange === 'quarter') {
      pDateFilter = "p.date >= date('now', '-3 months')";
      pPrevDateFilter = "p.date >= date('now', '-6 months') AND p.date < date('now', '-3 months')";
      iDateFilter = "i.date >= date('now', '-3 months')";
    } else if (validatedRange === 'year') {
      pDateFilter = "strftime('%Y', p.date) = strftime('%Y', 'now')";
      pPrevDateFilter = "strftime('%Y', p.date) = strftime('%Y', 'now', '-1 year')";
      iDateFilter = "strftime('%Y', i.date) = strftime('%Y', 'now')";
    }

    const totalRevenue = MetricsRepository.getTotalRevenue(session.userId, session.role, pDateFilter);
    const currentRevTotal = totalRevenue;
    const prevRevTotal = MetricsRepository.getTotalRevenue(session.userId, session.role, pPrevDateFilter);

    const growth = prevRevTotal > 0
      ? ((currentRevTotal - prevRevTotal) / prevRevTotal * 100).toFixed(1)
      : (currentRevTotal > 0 ? "100.0" : "0.0");

    const pendingRevenue = MetricsRepository.getPendingRevenue(session.userId, session.role, iDateFilter);
    const overdueRevenue = MetricsRepository.getOverdueRevenue(session.userId, session.role);

    const counts = MetricsRepository.getInvoiceCounts(session.userId, session.role);
    const pendingQuotesCount = MetricsRepository.getPendingQuotesCount(session.userId, session.role);
    const topClients = MetricsRepository.getTopClients(session.userId, session.role);
    const userPerformance = MetricsRepository.getUserPerformance(session.role);

    let revenueData: Array<{ date: string; revenue: number; label: string; value: number }> = [];
    if (validatedRange === 'month') {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 29);
      const startDateStr = startDate.toISOString().split('T')[0];

      const paymentsGrouped = MetricsRepository.getDailyRevenueGrouped(session.userId, session.role, startDateStr);
      const paymentsMap = new Map(paymentsGrouped.map(p => [p.date, p.total]));

      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const revenue = paymentsMap.get(dateStr) || 0;
        const label = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        revenueData.push({ date: dateStr, revenue, label, value: revenue });
      }
    } else {
      const paymentsGrouped = MetricsRepository.getMonthlyRevenueGrouped(session.userId, session.role);
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

    const { totalCount, methods } = MetricsRepository.getPaymentMethodDistribution(session.userId, session.role);
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

    const recentLogs = MetricsRepository.getRecentActivity(session.userId, session.role);
    const activityTimeline = recentLogs.map(log => {
      const dateVal = new Date(log.createdAt);
      const timeStr = dateVal.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' ' +
                      dateVal.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      return { id: log.id, action: log.details || log.action, client: log.userName || 'Système', time: timeStr };
    });

    const response: DashboardMetricsResponse = {
      totalRevenue,
      growth,
      pendingRevenue,
      overdueRevenue,
      ...counts,
      pendingQuotesCount,
      topClients,
      userPerformance,
      revenueData,
      paymentMethodData,
      activityTimeline,
    };

    return { success: true, data: response };
  } catch (error) {
    console.error('[Action getDashboardMetrics] Error:', error);
    return { success: false, error: 'Failed to compute dashboard metrics' };
  }
}
