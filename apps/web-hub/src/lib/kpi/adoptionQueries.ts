import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireSuperadmin } from "@/lib/auth/dal";

export type HealthCategory = "champion" | "stable" | "watch" | "churn_risk";

export interface HealthScoreResult {
  activityScore: number; // 0 - 30
  volumeScore: number; // 0 - 25
  syncQualityScore: number; // 0 - 25
  recoveryScore: number; // 0 - 20
  totalScore: number; // 0 - 100
  category: HealthCategory;
  isGracePeriod: boolean;
}

export interface TenantHealthDetail {
  tenantId: string;
  tenantName: string;
  status: string;
  planName: string;
  createdAt: string;
  devicesCount: number;
  lastSeenAt: string | null;
  daysSinceLastSeen: number;
  invoicesCount: number;
  invoicesLast30d: number;
  totalInvoicedXaf: number;
  totalPaidXaf: number;
  recoveryRate: number;
  syncRunsCount: number;
  syncSuccessRate: number;
  health: HealthScoreResult;
}

export interface FunnelStep {
  id: string;
  label: string;
  count: number;
  conversionRate: number; // Conversion depuis l'étape précédente
  overallRate: number; // Conversion depuis l'étape 1
  dropOffRate: number; // Taux d'abandon
  description: string;
}

export interface FeatureAdoptionMetric {
  featureKey: string;
  label: string;
  adoptedCount: number;
  totalCount: number;
  percentage: number;
  badge: string;
}

export interface AdoptionFunnelData {
  summary: {
    totalTenants: number;
    activeTenants: number;
    globalActivationRate: number;
    averageHealthScore: number;
    distribution: {
      champions: number;
      stable: number;
      watch: number;
      churnRisk: number;
    };
  };
  funnelSteps: FunnelStep[];
  featuresAdoption: FeatureAdoptionMetric[];
  churnRiskTenants: TenantHealthDetail[];
  allTenantsHealth: TenantHealthDetail[];
}

/**
 * Moteur algorithmique de calcul du Health Score client (0 - 100 pts).
 */
export function computeHealthScore(params: {
  createdAt: string;
  lastSeenAt: string | null;
  invoicesLast30d: number;
  syncRunsCount: number;
  syncErrorsCount: number;
  totalInvoicedXaf: number;
  totalPaidXaf: number;
  nowMs?: number;
}): HealthScoreResult {
  const now = params.nowMs ?? Date.now();
  const createdMs = new Date(params.createdAt).getTime();
  const isGracePeriod = (now - createdMs) < 7 * 24 * 60 * 60 * 1000;

  // 1. Activité & Fraîcheur de synchronisation (30 pts)
  let activityScore = 0;
  if (params.lastSeenAt) {
    const seenMs = new Date(params.lastSeenAt).getTime();
    const diffHours = (now - seenMs) / (3600 * 1000);
    if (diffHours <= 24) {
      activityScore = 30;
    } else if (diffHours <= 7 * 24) {
      activityScore = 15;
    } else {
      activityScore = 0;
    }
  } else if (isGracePeriod) {
    activityScore = 15; // Période d'onboarding initiale
  }

  // 2. Volume d'usage et facturation sur 30 jours (25 pts)
  let volumeScore = 0;
  if (params.invoicesLast30d >= 5) {
    volumeScore = 25;
  } else if (params.invoicesLast30d >= 1) {
    volumeScore = 15;
  } else if (isGracePeriod) {
    volumeScore = 10;
  } else {
    volumeScore = 0;
  }

  // 3. Fiabilité technique de la réplication (25 pts)
  let syncQualityScore = 0;
  if (params.syncRunsCount > 0) {
    const successRate = Math.max(
      0,
      ((params.syncRunsCount - params.syncErrorsCount) / params.syncRunsCount) * 100
    );
    if (successRate >= 95) {
      syncQualityScore = 25;
    } else if (successRate >= 80) {
      syncQualityScore = 15;
    } else {
      syncQualityScore = 5;
    }
  } else if (isGracePeriod) {
    syncQualityScore = 15;
  } else {
    syncQualityScore = 5;
  }

  // 4. Performance financière & recouvrement (20 pts)
  let recoveryScore = 0;
  if (params.totalInvoicedXaf > 0) {
    const recoveryRate = (params.totalPaidXaf / params.totalInvoicedXaf) * 100;
    if (recoveryRate >= 80) {
      recoveryScore = 20;
    } else if (recoveryRate >= 50) {
      recoveryScore = 10;
    } else {
      recoveryScore = 0;
    }
  } else {
    // Aucune créance émise
    recoveryScore = isGracePeriod ? 15 : 10;
  }

  const totalScore = Math.min(
    100,
    Math.max(0, activityScore + volumeScore + syncQualityScore + recoveryScore)
  );

  let category: HealthCategory = "churn_risk";
  if (totalScore >= 80) {
    category = "champion";
  } else if (totalScore >= 60) {
    category = "stable";
  } else if (totalScore >= 40) {
    category = "watch";
  } else {
    category = "churn_risk";
  }

  return {
    activityScore,
    volumeScore,
    syncQualityScore,
    recoveryScore,
    totalScore,
    category,
    isGracePeriod,
  };
}

/**
 * Récupération brute des données d'Adoption et Health Score avec Service Role.
 * Exécution parallèle Promise.all des 6 requêtes sans accès aux cookies.
 */
async function fetchAdoptionFunnelDataRaw(): Promise<AdoptionFunnelData> {
  const supabase = createAdminClient();

  const now = Date.now();
  const d30Ago = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Exécution parallèle des 6 tables d'analyse sans aucun waterfall
  const [
    { data: tenantsData },
    { data: devicesData },
    { data: invoicesData },
    { data: quotesData },
    { data: paymentsData },
    { data: syncRunsData },
  ] = await Promise.all([
    supabase
      .from("tenants")
      .select(`
        id,
        name,
        status,
        created_at,
        plans (
          name,
          price_xaf
        )
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("sync_devices")
      .select("device_id, tenant_id, last_seen_at"),
    supabase
      .from("invoices")
      .select("id, tenant_id, total, created_at")
      .is("deleted_at", null),
    supabase
      .from("quotes")
      .select("id, tenant_id")
      .is("deleted_at", null),
    supabase
      .from("payments")
      .select("id, tenant_id, amount")
      .is("deleted_at", null),
    supabase
      .from("sync_runs")
      .select("tenant_id, error_count"),
  ]);

  const tenants = tenantsData || [];
  const totalTenants = tenants.length;

  const devicesByTenant = new Map<
    string,
    { count: number; lastSeenAt: string | null }
  >();

  (devicesData || []).forEach((d: any) => {
    const cur = devicesByTenant.get(d.tenant_id) || { count: 0, lastSeenAt: null };
    cur.count++;
    if (!cur.lastSeenAt || new Date(d.last_seen_at) > new Date(cur.lastSeenAt)) {
      cur.lastSeenAt = d.last_seen_at;
    }
    devicesByTenant.set(d.tenant_id, cur);
  });

  const invoicesByTenant = new Map<
    string,
    { count: number; last30d: number; totalXaf: number }
  >();

  (invoicesData || []).forEach((inv: any) => {
    const tId = inv.tenant_id;
    const cur = invoicesByTenant.get(tId) || { count: 0, last30d: 0, totalXaf: 0 };
    cur.count++;
    cur.totalXaf += Number(inv.total) || 0;
    if (inv.created_at && inv.created_at >= d30Ago) {
      cur.last30d++;
    }
    invoicesByTenant.set(tId, cur);
  });

  const quotesByTenant = new Set<string>();
  (quotesData || []).forEach((q: any) => quotesByTenant.add(q.tenant_id));

  const paymentsByTenant = new Map<string, { count: number; totalXaf: number }>();
  (paymentsData || []).forEach((p: any) => {
    const tId = p.tenant_id;
    const cur = paymentsByTenant.get(tId) || { count: 0, totalXaf: 0 };
    cur.count++;
    cur.totalXaf += Number(p.amount) || 0;
    paymentsByTenant.set(tId, cur);
  });

  const syncRunsByTenant = new Map<string, { runs: number; errors: number }>();
  (syncRunsData || []).forEach((r: any) => {
    const cur = syncRunsByTenant.get(r.tenant_id) || { runs: 0, errors: 0 };
    cur.runs++;
    if (Number(r.error_count) > 0) cur.errors++;
    syncRunsByTenant.set(r.tenant_id, cur);
  });

  // Calcul du Health Score pour chaque tenant
  const allTenantsHealth: TenantHealthDetail[] = tenants.map((t: any) => {
    const dInfo = devicesByTenant.get(t.id) || { count: 0, lastSeenAt: null };
    const invInfo = invoicesByTenant.get(t.id) || { count: 0, last30d: 0, totalXaf: 0 };
    const payInfo = paymentsByTenant.get(t.id) || { count: 0, totalXaf: 0 };
    const syncInfo = syncRunsByTenant.get(t.id) || { runs: 0, errors: 0 };

    const daysSince = dInfo.lastSeenAt
      ? Math.max(0, Math.floor((now - new Date(dInfo.lastSeenAt).getTime()) / (24 * 3600 * 1000)))
      : 999;

    const recoveryRate =
      invInfo.totalXaf > 0
        ? Math.round((payInfo.totalXaf / invInfo.totalXaf) * 1000) / 10
        : 0;

    const syncSuccessRate =
      syncInfo.runs > 0
        ? Math.round(((syncInfo.runs - syncInfo.errors) / syncInfo.runs) * 100)
        : 100;

    const health = computeHealthScore({
      createdAt: t.created_at,
      lastSeenAt: dInfo.lastSeenAt,
      invoicesLast30d: invInfo.last30d,
      syncRunsCount: syncInfo.runs,
      syncErrorsCount: syncInfo.errors,
      totalInvoicedXaf: invInfo.totalXaf,
      totalPaidXaf: payInfo.totalXaf,
      nowMs: now,
    });

    return {
      tenantId: t.id,
      tenantName: t.name || "Entreprise",
      status: t.status || "active",
      planName: t.plans?.name || "Sans abonnement",
      createdAt: t.created_at,
      devicesCount: dInfo.count,
      lastSeenAt: dInfo.lastSeenAt,
      daysSinceLastSeen: daysSince,
      invoicesCount: invInfo.count,
      invoicesLast30d: invInfo.last30d,
      totalInvoicedXaf: invInfo.totalXaf,
      totalPaidXaf: payInfo.totalXaf,
      recoveryRate,
      syncRunsCount: syncInfo.runs,
      syncSuccessRate,
      health,
    };
  });

  // Calcul du Funnel d'Adoption
  // Étape 1 : Tous les tenants
  const step1Count = totalTenants;
  // Étape 2 : Tenants avec au moins 1 device
  const step2Count = allTenantsHealth.filter((t) => t.devicesCount > 0).length;
  // Étape 3 : Tenants avec au moins 1 document (facture ou devis)
  const step3Count = allTenantsHealth.filter(
    (t) => t.invoicesCount > 0 || quotesByTenant.has(t.tenantId)
  ).length;
  // Étape 4 : Tenants avec au moins 1 paiement
  const step4Count = allTenantsHealth.filter(
    (t) => (paymentsByTenant.get(t.tenantId)?.count || 0) > 0
  ).length;

  const funnelSteps: FunnelStep[] = [
    {
      id: "step_1_created",
      label: "1. Entreprises Inscrites",
      count: step1Count,
      conversionRate: 100,
      overallRate: 100,
      dropOffRate: 0,
      description: "Comptes tenants enregistrés dans la plateforme Hub",
    },
    {
      id: "step_2_device",
      label: "2. Premier Desktop Connecté",
      count: step2Count,
      conversionRate: step1Count > 0 ? Math.round((step2Count / step1Count) * 100) : 0,
      overallRate: step1Count > 0 ? Math.round((step2Count / step1Count) * 100) : 0,
      dropOffRate:
        step1Count > 0 ? Math.round(((step1Count - step2Count) / step1Count) * 100) : 0,
      description: "Installation et premier démarrage de l'app Electron Desktop",
    },
    {
      id: "step_3_document",
      label: "3. Première Facture / Devis",
      count: step3Count,
      conversionRate: step2Count > 0 ? Math.round((step3Count / step2Count) * 100) : 0,
      overallRate: step1Count > 0 ? Math.round((step3Count / step1Count) * 100) : 0,
      dropOffRate:
        step2Count > 0 ? Math.round(((step2Count - step3Count) / step2Count) * 100) : 0,
      description: "Création et émission d'une première pièce commerciale",
    },
    {
      id: "step_4_payment",
      label: "4. Premier Règlement Encaissé",
      count: step4Count,
      conversionRate: step3Count > 0 ? Math.round((step4Count / step3Count) * 100) : 0,
      overallRate: step1Count > 0 ? Math.round((step4Count / step1Count) * 100) : 0,
      dropOffRate:
        step3Count > 0 ? Math.round(((step3Count - step4Count) / step3Count) * 100) : 0,
      description: "Enregistrement d'un premier encaissement réel sur facture",
    },
  ];

  // Synthèse & Distribution Health Score
  const distribution = {
    champions: 0,
    stable: 0,
    watch: 0,
    churnRisk: 0,
  };

  let totalScoreSum = 0;
  let activeTenants = 0;

  allTenantsHealth.forEach((t) => {
    if (t.status === "active" || t.status === "trial") activeTenants++;
    totalScoreSum += t.health.totalScore;
    if (t.health.category === "champion") distribution.champions++;
    else if (t.health.category === "stable") distribution.stable++;
    else if (t.health.category === "watch") distribution.watch++;
    else if (t.health.category === "churn_risk") distribution.churnRisk++;
  });

  const averageHealthScore =
    totalTenants > 0 ? Math.round(totalScoreSum / totalTenants) : 0;
  const globalActivationRate =
    step1Count > 0 ? Math.round((step4Count / step1Count) * 100) : 0;

  // Adoption des fonctionnalités avancées
  const multiDeviceCount = allTenantsHealth.filter((t) => t.devicesCount > 1).length;
  const quotesCount = quotesByTenant.size;
  const regularSyncCount = allTenantsHealth.filter((t) => t.daysSinceLastSeen <= 1).length;

  const featuresAdoption: FeatureAdoptionMetric[] = [
    {
      featureKey: "multi_device",
      label: "Parc Multi-Postes (≥ 2 postes)",
      adoptedCount: multiDeviceCount,
      totalCount: totalTenants,
      percentage: totalTenants > 0 ? Math.round((multiDeviceCount / totalTenants) * 100) : 0,
      badge: "Architecture Hub & Spoke",
    },
    {
      featureKey: "quotes",
      label: "Module Devis & Proformas",
      adoptedCount: quotesCount,
      totalCount: totalTenants,
      percentage: totalTenants > 0 ? Math.round((quotesCount / totalTenants) * 100) : 0,
      badge: "Cycle Commercial",
    },
    {
      featureKey: "continuous_sync",
      label: "Synchronisation Quotidienne (< 24h)",
      adoptedCount: regularSyncCount,
      totalCount: totalTenants,
      percentage: totalTenants > 0 ? Math.round((regularSyncCount / totalTenants) * 100) : 0,
      badge: "Local-First Cloud Sync",
    },
  ];

  // Tenants prioritaires à risque de Churn (score < 50 ou inactifs depuis > 14 jours)
  const churnRiskTenants = allTenantsHealth
    .filter(
      (t) =>
        (t.health.category === "churn_risk" ||
          t.health.category === "watch" ||
          t.daysSinceLastSeen > 14) &&
        !t.health.isGracePeriod
    )
    .sort((a, b) => a.health.totalScore - b.health.totalScore);

  return {
    summary: {
      totalTenants,
      activeTenants,
      globalActivationRate,
      averageHealthScore,
      distribution,
    },
    funnelSteps,
    featuresAdoption,
    churnRiskTenants,
    allTenantsHealth,
  };
}

/**
 * Cache intermédiaire sur le Data Cache Next.js (Vercel Edge / Node).
 * Revalidation toutes les 30s avec tag d'invalidation 'hub-adoption'.
 */
const getCachedAdoptionFunnelData = unstable_cache(
  fetchAdoptionFunnelDataRaw,
  ["hub-adoption-funnel"],
  {
    revalidate: 30,
    tags: ["hub-adoption", "hub-kpis"],
  }
);

/**
 * Point d'entrée sécurisé pour les composants serveur du Hub.
 * Valide l'authentification Superadmin puis sert les données d'adoption depuis le Data Cache en 0ms.
 */
export const getAdoptionFunnelData = cache(async (): Promise<AdoptionFunnelData> => {
  await requireSuperadmin();
  return getCachedAdoptionFunnelData();
});
