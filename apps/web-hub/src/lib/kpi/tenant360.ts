import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireSuperadmin } from "@/lib/auth/dal";

export interface TenantListItem {
  id: string;
  name: string;
  status: "active" | "trial" | "suspended" | "expired";
  planCode: string;
  planName: string;
  priceXaf: number;
  country: string;
  licenseExpiresAt: string | null;
  usersCount: number;
  devicesCount: number;
  createdAt: string;
}

export interface Tenant360Data {
  tenant: {
    id: string;
    name: string;
    status: "active" | "trial" | "suspended" | "expired";
    country: string;
    trialEndsAt: string | null;
    licenseExpiresAt: string | null;
    suspendedReason: string | null;
    suspendedAt: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  };
  plan: {
    id: string;
    code: string;
    name: string;
    priceXaf: number;
    billingPeriod: string;
    maxUsers: number;
    maxDevices: number;
  } | null;
  users: Array<{
    id: string;
    email: string;
    fullName: string | null;
    role: string;
    isActive: boolean;
    createdAt: string;
  }>;
  devices: Array<{
    deviceId: string;
    deviceName: string | null;
    os: string | null;
    appVersion: string | null;
    lastSeenAt: string;
    lastSyncAt: string | null;
    lastStatus: "success" | "error" | "pending";
  }>;
  recentSyncRuns: Array<{
    id: string;
    deviceId: string;
    durationMs: number;
    pushed: number;
    pulled: number;
    errorCount: number;
    createdAt: string;
  }>;
  finance: {
    invoicesCount: number;
    quotesCount: number;
    totalRevenueXaf: number;
    totalPaidXaf: number;
    pendingXaf: number;
  };
  auditLogs: Array<{
    id: string;
    actorEmail: string;
    action: string;
    reason: string | null;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
}

/**
 * Récupération brute des entreprises clientes avec Service Role sans accès aux cookies.
 */
async function fetchTenantsListRaw(): Promise<TenantListItem[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("tenants")
    .select(`
      id,
      name,
      status,
      country,
      license_expires_at,
      created_at,
      plan_id,
      plans(code, name, price_xaf),
      profiles(count),
      sync_devices(count)
    `)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("[getTenantsList] Erreur de récupération :", error?.message);
    return [];
  }

  return data.map((t: any) => ({
    id: t.id,
    name: t.name,
    status: (t.status || "active").toLowerCase() as any,
    planCode: t.plans?.code || "starter",
    planName: t.plans?.name || "Plan Starter",
    priceXaf: Number(t.plans?.price_xaf || 0),
    country: t.country || "Cameroun",
    licenseExpiresAt: t.license_expires_at,
    usersCount: t.profiles?.[0]?.count || 0,
    devicesCount: t.sync_devices?.[0]?.count || 0,
    createdAt: t.created_at,
  }));
}

const getCachedTenantsList = unstable_cache(
  fetchTenantsListRaw,
  ["hub-tenants-list-all"],
  {
    revalidate: 30,
    tags: ["hub-tenants", "hub-kpis"],
  }
);

/**
 * Récupère la liste filtrable et triable des entreprises clientes.
 * Mémoïsé par requête via React.cache() et préchargé dans le Data Cache en 0ms.
 */
export const getTenantsList = cache(async (filters?: {
  search?: string;
  status?: string;
  planId?: string;
}): Promise<TenantListItem[]> => {
  await requireSuperadmin();
  const allTenants = await getCachedTenantsList();
  if (!filters) return allTenants;

  let filtered = allTenants;
  if (filters.status && filters.status !== "all") {
    filtered = filtered.filter((t) => t.status === filters.status);
  }
  if (filters.planId && filters.planId !== "all") {
    filtered = filtered.filter((t) => t.planCode === filters.planId);
  }
  if (filters.search && filters.search.trim().length > 0) {
    const s = filters.search.trim().toLowerCase();
    filtered = filtered.filter((t) => t.name.toLowerCase().includes(s));
  }
  return filtered;
});

/**
 * Récupère la vue 360° exhaustive d'un tenant pour le Super Admin.
 */
export const getTenant360 = cache(async (tenantId: string): Promise<Tenant360Data | null> => {
  await requireSuperadmin();
  const supabase = createAdminClient();

  // 1. Informations du tenant
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .select(`
      *,
      plans(*)
    `)
    .eq("id", tenantId)
    .single();

  if (tenantErr || !tenant) {
    return null;
  }

  // 2 à 6. Exécution simultanée de tous les sous-enregistrements sans aucun waterfall
  const [
    { data: usersData },
    { data: devicesData },
    { data: syncRunsData },
    { data: invoicesData },
    { data: paymentsData },
    { data: quotesData },
    { data: auditData },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, role, is_active, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("sync_devices")
      .select("device_id, device_name, os, app_version, last_seen_at, last_sync_at, last_status")
      .eq("tenant_id", tenantId)
      .order("last_seen_at", { ascending: false }),
    supabase
      .from("sync_runs")
      .select("id, device_id, duration_ms, pushed, pulled, error_count, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("invoices")
      .select("total, status")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    supabase
      .from("payments")
      .select("amount")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    supabase
      .from("quotes")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    supabase
      .from("hub_audit_logs")
      .select("id, actor_email, action, reason, created_at, metadata")
      .or(`tenant_id.eq.${tenantId},target_id.eq.${tenantId}`)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  let totalRevenueXaf = 0;
  invoicesData?.forEach((inv: any) => {
    totalRevenueXaf += Number(inv.total) || 0;
  });

  let totalPaidXaf = 0;
  paymentsData?.forEach((p: any) => {
    totalPaidXaf += Number(p.amount) || 0;
  });

  const pendingXaf = Math.max(0, totalRevenueXaf - totalPaidXaf);

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      status: (tenant.status || "active").toLowerCase() as any,
      country: tenant.country || "Cameroun",
      trialEndsAt: tenant.trial_ends_at,
      licenseExpiresAt: tenant.license_expires_at,
      suspendedReason: tenant.suspended_reason,
      suspendedAt: tenant.suspended_at,
      notes: tenant.notes,
      createdAt: tenant.created_at,
      updatedAt: tenant.updated_at,
    },
    plan: tenant.plans
      ? {
          id: tenant.plans.id,
          code: tenant.plans.code,
          name: tenant.plans.name,
          priceXaf: Number(tenant.plans.price_xaf || 0),
          billingPeriod: tenant.plans.billing_period,
          maxUsers: tenant.plans.max_users,
          maxDevices: tenant.plans.max_devices,
        }
      : null,
    users: (usersData || []).map((u) => ({
      id: u.id,
      email: u.email || "",
      fullName: u.full_name,
      role: u.role,
      isActive: u.is_active,
      createdAt: u.created_at,
    })),
    devices: (devicesData || []).map((d) => ({
      deviceId: d.device_id,
      deviceName: d.device_name,
      os: d.os,
      appVersion: d.app_version,
      lastSeenAt: d.last_seen_at,
      lastSyncAt: d.last_sync_at,
      lastStatus: d.last_status,
    })),
    recentSyncRuns: (syncRunsData || []).map((r) => ({
      id: r.id,
      deviceId: r.device_id,
      durationMs: r.duration_ms,
      pushed: r.pushed,
      pulled: r.pulled,
      errorCount: r.error_count,
      createdAt: r.created_at,
    })),
    finance: {
      invoicesCount: invoicesData?.length || 0,
      quotesCount: quotesData?.length || 0,
      totalRevenueXaf,
      totalPaidXaf,
      pendingXaf,
    },
    auditLogs: (auditData || []).map((a) => ({
      id: a.id,
      actorEmail: a.actor_email,
      action: a.action,
      reason: a.reason,
      createdAt: a.created_at,
      metadata: (a.metadata || {}) as Record<string, unknown>,
    })),
  };
});
