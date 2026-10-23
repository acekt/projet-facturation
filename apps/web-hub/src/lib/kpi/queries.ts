import { createClient } from "@/utils/supabase/server";
import { requireSuperadmin } from "@/lib/auth/dal";

export interface HubOverviewData {
  tenants: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    expired: number;
  };
  mrrEstimateXaf: number;
  fleet: {
    totalDevices: number;
    activeLast24h: number;
    stale7d: number;
    errorStatus: number;
  };
  todayMetrics: {
    documentsCreated: number;
    revenueXaf: number;
    syncRuns: number;
    syncErrors: number;
  };
  alerts: {
    totalOpen: number;
    critical: number;
    warning: number;
  };
}

export interface FleetDeviceItem {
  deviceId: string;
  tenantId: string;
  tenantName: string;
  deviceName?: string | null;
  os?: string | null;
  appVersion?: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastSyncAt?: string | null;
  lastStatus: "success" | "error" | "pending";
}

/**
 * Récupère les métriques de synthèse du Hub Super Admin.
 * Exécutable uniquement côté serveur avec droits Superadmin.
 */
export async function getHubOverview(): Promise<HubOverviewData> {
  await requireSuperadmin();
  const supabase = await createClient();

  // 1. Synthèse des Tenants et Plans
  const { data: tenantsData } = await supabase
    .from("tenants")
    .select("id, status, plan_id, plans(price_xaf)");

  const tenants = {
    total: tenantsData?.length || 0,
    active: 0,
    trial: 0,
    suspended: 0,
    expired: 0,
  };

  let mrrEstimateXaf = 0;

  tenantsData?.forEach((t: any) => {
    const status = (t.status || "active").toLowerCase();
    if (status === "active") tenants.active++;
    else if (status === "trial") tenants.trial++;
    else if (status === "suspended") tenants.suspended++;
    else if (status === "expired") tenants.expired++;

    if (status === "active" && t.plans?.price_xaf) {
      mrrEstimateXaf += Number(t.plans.price_xaf);
    }
  });

  // 2. Synthèse de la Flotte de Postes
  const { data: devicesData } = await supabase
    .from("sync_devices")
    .select("device_id, last_seen_at, last_status");

  const now = Date.now();
  const h24Ago = now - 24 * 60 * 60 * 1000;
  const d7Ago = now - 7 * 24 * 60 * 60 * 1000;

  const fleet = {
    totalDevices: devicesData?.length || 0,
    activeLast24h: 0,
    stale7d: 0,
    errorStatus: 0,
  };

  devicesData?.forEach((d) => {
    const seen = new Date(d.last_seen_at).getTime();
    if (seen >= h24Ago) fleet.activeLast24h++;
    if (seen < d7Ago) fleet.stale7d++;
    if (d.last_status === "error") fleet.errorStatus++;
  });

  // 3. Activité du jour (depuis kpi_tenant_daily ou sync_runs)
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data: todayKpis } = await supabase
    .from("kpi_tenant_daily")
    .select("documents_created, total_revenue_xaf, sync_count, sync_errors_count")
    .eq("metric_date", todayIso);

  const todayMetrics = {
    documentsCreated: 0,
    revenueXaf: 0,
    syncRuns: 0,
    syncErrors: 0,
  };

  todayKpis?.forEach((k) => {
    todayMetrics.documentsCreated += k.documents_created || 0;
    todayMetrics.revenueXaf += Number(k.total_revenue_xaf) || 0;
    todayMetrics.syncRuns += k.sync_count || 0;
    todayMetrics.syncErrors += k.sync_errors_count || 0;
  });

  // 4. Alertes ouvertes
  const { data: alertsData } = await supabase
    .from("alerts")
    .select("id, severity, status")
    .eq("status", "open");

  const alerts = {
    totalOpen: alertsData?.length || 0,
    critical: 0,
    warning: 0,
  };

  alertsData?.forEach((a) => {
    if (a.severity === "critical") alerts.critical++;
    else if (a.severity === "warning") alerts.warning++;
  });

  return {
    tenants,
    mrrEstimateXaf,
    fleet,
    todayMetrics,
    alerts,
  };
}

/**
 * Récupère l'inventaire complet de la flotte de postes synchronisés.
 */
export async function getFleetDevices(): Promise<FleetDeviceItem[]> {
  await requireSuperadmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sync_devices")
    .select(`
      device_id,
      tenant_id,
      device_name,
      os,
      app_version,
      first_seen_at,
      last_seen_at,
      last_sync_at,
      last_status,
      tenants(name)
    `)
    .order("last_seen_at", { ascending: false });

  if (error || !data) return [];

  return data.map((d: any) => ({
    deviceId: d.device_id,
    tenantId: d.tenant_id,
    tenantName: d.tenants?.name || "Inconnu",
    deviceName: d.device_name,
    os: d.os,
    appVersion: d.app_version,
    firstSeenAt: d.first_seen_at,
    lastSeenAt: d.last_seen_at,
    lastSyncAt: d.last_sync_at,
    lastStatus: d.last_status,
  }));
}
