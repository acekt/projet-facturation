import { createClient } from "@/utils/supabase/server";
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
 * Récupère la liste filtrable et triable des entreprises clientes.
 */
export async function getTenantsList(filters?: {
  search?: string;
  status?: string;
  planId?: string;
}): Promise<TenantListItem[]> {
  await requireSuperadmin();
  const supabase = await createClient();

  let query = supabase
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

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters?.planId && filters.planId !== "all") {
    query = query.eq("plan_id", filters.planId);
  }

  if (filters?.search && filters.search.trim().length > 0) {
    query = query.ilike("name", `%${filters.search.trim()}%`);
  }

  const { data, error } = await query;
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

/**
 * Récupère la vue 360° exhaustive d'un tenant pour le Super Admin.
 */
export async function getTenant360(tenantId: string): Promise<Tenant360Data | null> {
  await requireSuperadmin();
  const supabase = await createClient();

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

  // 2. Utilisateurs du tenant
  const { data: usersData } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  // 3. Postes Desktop de la flotte
  const { data: devicesData } = await supabase
    .from("sync_devices")
    .select("device_id, device_name, os, app_version, last_seen_at, last_sync_at, last_status")
    .eq("tenant_id", tenantId)
    .order("last_seen_at", { ascending: false });

  // 4. Derniers cycles de synchronisation
  const { data: syncRunsData } = await supabase
    .from("sync_runs")
    .select("id, device_id, duration_ms, pushed, pulled, error_count, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(10);

  // 5. Synthèse financière (depuis factures et paiements de ce tenant)
  const { data: invoicesData } = await supabase
    .from("invoices")
    .select("total, status")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  const { data: paymentsData } = await supabase
    .from("payments")
    .select("amount")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  const { data: quotesData } = await supabase
    .from("quotes")
    .select("id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  let totalRevenueXaf = 0;
  invoicesData?.forEach((inv) => {
    totalRevenueXaf += Number(inv.total) || 0;
  });

  let totalPaidXaf = 0;
  paymentsData?.forEach((p) => {
    totalPaidXaf += Number(p.amount) || 0;
  });

  const pendingXaf = Math.max(0, totalRevenueXaf - totalPaidXaf);

  // 6. Historique des audits spécifiques à ce tenant
  const { data: auditData } = await supabase
    .from("hub_audit_logs")
    .select("id, actor_email, action, reason, created_at, metadata")
    .or(`tenant_id.eq.${tenantId},target_id.eq.${tenantId}`)
    .order("created_at", { ascending: false })
    .limit(20);

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
}
