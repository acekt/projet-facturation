import { createClient } from "@/utils/supabase/server";
import { requireSuperadmin } from "@/lib/auth/dal";

export interface TopTenantRevenue {
  tenantId: string;
  tenantName: string;
  planName: string;
  invoicesCount: number;
  invoicedXaf: number;
  paidXaf: number;
  outstandingXaf: number;
  recoveryRate: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  label: string;
  totalXaf: number;
  count: number;
  percentage: number;
}

export interface RevenueTimeSeriesPoint {
  date: string;
  invoicedXaf: number;
  paidXaf: number;
}

export interface FinancialOverviewData {
  summary: {
    totalInvoicedXaf: number;
    totalPaidXaf: number;
    outstandingXaf: number;
    recoveryRate: number;
    totalQuotesXaf: number;
    invoicesCount: number;
    paidInvoicesCount: number;
    overdueInvoicesCount: number;
    mrrEstimateXaf: number;
  };
  topTenants: TopTenantRevenue[];
  paymentMethods: PaymentMethodBreakdown[];
  timeSeries: RevenueTimeSeriesPoint[];
}

/**
 * Normalise le libellé d'un mode de règlement pour la présentation.
 */
function normalizePaymentMethod(method: string | null): string {
  if (!method) return "Autre / Non spécifié";
  const m = method.toLowerCase().trim();
  if (m.includes("cash") || m.includes("espece") || m.includes("espèce")) return "Espèces";
  if (m.includes("virement") || m.includes("bank") || m.includes("transfer")) return "Virement Bancaire";
  if (m.includes("momo") || m.includes("mtn") || m.includes("mobile") || m.includes("orange") || m.includes("om")) return "Mobile Money";
  if (m.includes("cheque") || m.includes("chèque")) return "Chèque";
  if (m.includes("carte") || m.includes("card")) return "Carte Bancaire";
  return method;
}

/**
 * Récupère l'ensemble des données financières consolidées du Hub Super Admin.
 */
export async function getFinancialOverview(): Promise<FinancialOverviewData> {
  await requireSuperadmin();
  const supabase = await createClient();

  // 1. Récupération des tenants & plans pour le MRR et les noms
  const { data: tenantsData } = await supabase
    .from("tenants")
    .select(`
      id,
      name,
      status,
      plans (
        name,
        price_xaf
      )
    `);

  const tenantMap = new Map<string, { name: string; planName: string; priceXaf: number }>();
  let mrrEstimateXaf = 0;

  (tenantsData || []).forEach((t: any) => {
    const planName = t.plans?.name || "Sans abonnement";
    const priceXaf = Number(t.plans?.price_xaf) || 0;
    tenantMap.set(t.id, { name: t.name || "Entreprise", planName, priceXaf });
    if ((t.status || "active").toLowerCase() === "active") {
      mrrEstimateXaf += priceXaf;
    }
  });

  // 2. Récupération des factures non supprimées
  const { data: invoicesData } = await supabase
    .from("invoices")
    .select("id, tenant_id, number, client_name, total, status, date, created_at, deleted_at")
    .is("deleted_at", null);

  // 3. Récupération des paiements non supprimés
  const { data: paymentsData } = await supabase
    .from("payments")
    .select("id, tenant_id, invoice_id, amount, payment_method, date, created_at, deleted_at")
    .is("deleted_at", null);

  // 4. Récupération des devis non supprimés
  const { data: quotesData } = await supabase
    .from("quotes")
    .select("id, tenant_id, total, status, deleted_at")
    .is("deleted_at", null);

  // Calculs globaux des factures
  let totalInvoicedXaf = 0;
  let invoicesCount = 0;
  let paidInvoicesCount = 0;
  let overdueInvoicesCount = 0;

  const tenantFinancials = new Map<
    string,
    { invoiced: number; paid: number; count: number }
  >();

  (invoicesData || []).forEach((inv: any) => {
    const amount = Number(inv.total) || 0;
    totalInvoicedXaf += amount;
    invoicesCount++;

    const status = (inv.status || "").toLowerCase();
    if (status === "paid") paidInvoicesCount++;
    if (status === "overdue") overdueInvoicesCount++;

    const tId = inv.tenant_id;
    if (tId) {
      const cur = tenantFinancials.get(tId) || { invoiced: 0, paid: 0, count: 0 };
      cur.invoiced += amount;
      cur.count++;
      tenantFinancials.set(tId, cur);
    }
  });

  // Calculs globaux des paiements
  let totalPaidXaf = 0;
  const methodsMap = new Map<string, { total: number; count: number }>();

  (paymentsData || []).forEach((p: any) => {
    const amount = Number(p.amount) || 0;
    totalPaidXaf += amount;

    const tId = p.tenant_id;
    if (tId) {
      const cur = tenantFinancials.get(tId) || { invoiced: 0, paid: 0, count: 0 };
      cur.paid += amount;
      tenantFinancials.set(tId, cur);
    }

    const normMethod = normalizePaymentMethod(p.payment_method);
    const mCur = methodsMap.get(normMethod) || { total: 0, count: 0 };
    mCur.total += amount;
    mCur.count++;
    methodsMap.set(normMethod, mCur);
  });

  // Calculs globaux des devis
  let totalQuotesXaf = 0;
  (quotesData || []).forEach((q: any) => {
    totalQuotesXaf += Number(q.total) || 0;
  });

  const outstandingXaf = Math.max(0, totalInvoicedXaf - totalPaidXaf);
  const recoveryRate =
    totalInvoicedXaf > 0
      ? Math.round((totalPaidXaf / totalInvoicedXaf) * 1000) / 10
      : 0;

  // Classement des 10 premiers contributeurs
  const topTenants: TopTenantRevenue[] = Array.from(tenantFinancials.entries())
    .map(([tId, fin]) => {
      const info = tenantMap.get(tId) || { name: `Tenant ${tId.slice(0, 8)}`, planName: "Inconnu", priceXaf: 0 };
      const recRate = fin.invoiced > 0 ? Math.round((fin.paid / fin.invoiced) * 1000) / 10 : 0;
      return {
        tenantId: tId,
        tenantName: info.name,
        planName: info.planName,
        invoicesCount: fin.count,
        invoicedXaf: fin.invoiced,
        paidXaf: fin.paid,
        outstandingXaf: Math.max(0, fin.invoiced - fin.paid),
        recoveryRate: recRate,
      };
    })
    .sort((a, b) => b.invoicedXaf - a.invoicedXaf)
    .slice(0, 10);

  // Ventilation des modes de règlement
  const paymentMethods: PaymentMethodBreakdown[] = Array.from(methodsMap.entries())
    .map(([method, data]) => ({
      method,
      label: method,
      totalXaf: data.total,
      count: data.count,
      percentage: totalPaidXaf > 0 ? Math.round((data.total / totalPaidXaf) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.totalXaf - a.totalXaf);

  // Construction de la série temporelle (derniers 30 jours)
  // On regroupe par date
  const dateMap = new Map<string, { invoiced: number; paid: number }>();

  // Générer les 30 derniers jours
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    dateMap.set(key, { invoiced: 0, paid: 0 });
  }

  (invoicesData || []).forEach((inv: any) => {
    const dateStr = (inv.date || inv.created_at || "").slice(0, 10);
    if (dateMap.has(dateStr)) {
      const cur = dateMap.get(dateStr)!;
      cur.invoiced += Number(inv.total) || 0;
    }
  });

  (paymentsData || []).forEach((p: any) => {
    const dateStr = (p.date || p.created_at || "").slice(0, 10);
    if (dateMap.has(dateStr)) {
      const cur = dateMap.get(dateStr)!;
      cur.paid += Number(p.amount) || 0;
    }
  });

  const timeSeries: RevenueTimeSeriesPoint[] = Array.from(dateMap.entries()).map(
    ([date, vals]) => ({
      date,
      invoicedXaf: vals.invoiced,
      paidXaf: vals.paid,
    })
  );

  return {
    summary: {
      totalInvoicedXaf,
      totalPaidXaf,
      outstandingXaf,
      recoveryRate,
      totalQuotesXaf,
      invoicesCount,
      paidInvoicesCount,
      overdueInvoicesCount,
      mrrEstimateXaf,
    },
    topTenants,
    paymentMethods,
    timeSeries,
  };
}
