import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireSuperadmin } from "@/lib/auth/dal";

export interface HubAuditItem {
  id: string;
  createdAt: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  reason: string | null;
  metadata: Record<string, any>;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface SecurityAuditOverviewData {
  summary: {
    totalLogs: number;
    breakGlassCount: number;
    suspensionsCount: number;
    planUpdatesCount: number;
    licenseExtensionsCount: number;
    uniqueActorsCount: number;
  };
  logs: HubAuditItem[];
}

/**
 * Récupération brute du journal d'audit avec Service Role sans accès aux cookies.
 */
async function fetchSecurityAuditLogsRaw(limit: number = 200): Promise<SecurityAuditOverviewData> {
  const supabase = createAdminClient();

  let query = supabase
    .from("hub_audit_logs")
    .select(`
      id,
      created_at,
      actor_id,
      actor_email,
      action,
      target_type,
      target_id,
      tenant_id,
      reason,
      metadata,
      ip_address,
      user_agent,
      tenants (
        name
      )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data: logsData, error } = await query;
  if (error) {
    console.error("[getSecurityAuditLogs] Erreur de récupération :", error.message);
  }

  const rawLogs = logsData || [];

  let breakGlassCount = 0;
  let suspensionsCount = 0;
  let planUpdatesCount = 0;
  let licenseExtensionsCount = 0;
  const uniqueActors = new Set<string>();

  const logs: HubAuditItem[] = rawLogs.map((item: any) => {
    uniqueActors.add(item.actor_email);
    const action = item.action || "";

    if (action.includes("BREAK_GLASS")) breakGlassCount++;
    if (action.includes("SUSPEND")) suspensionsCount++;
    if (action.includes("PLAN")) planUpdatesCount++;
    if (action.includes("LICENSE") || action.includes("EXTEND")) licenseExtensionsCount++;

    return {
      id: item.id,
      createdAt: item.created_at,
      actorId: item.actor_id,
      actorEmail: item.actor_email,
      action: item.action,
      targetType: item.target_type,
      targetId: item.target_id,
      tenantId: item.tenant_id,
      tenantName: item.tenants?.name || null,
      reason: item.reason,
      metadata: item.metadata || {},
      ipAddress: item.ip_address,
      userAgent: item.user_agent,
    };
  });

  return {
    summary: {
      totalLogs: logs.length,
      breakGlassCount,
      suspensionsCount,
      planUpdatesCount,
      licenseExtensionsCount,
      uniqueActorsCount: uniqueActors.size,
    },
    logs,
  };
}

const getCachedSecurityAuditLogs = unstable_cache(
  fetchSecurityAuditLogsRaw,
  ["hub-security-audit-logs"],
  {
    revalidate: 15,
    tags: ["hub-audit", "hub-security"],
  }
);

/**
 * Récupère le journal d'audit immuable du Hub Web Super Admin.
 * Mémoïsé par requête via React.cache() et servi depuis le Data Cache en 0ms.
 */
export const getSecurityAuditLogs = cache(async (filters?: {
  action?: string;
  actorEmail?: string;
  limit?: number;
}): Promise<SecurityAuditOverviewData> => {
  await requireSuperadmin();
  const base = await getCachedSecurityAuditLogs(filters?.limit || 200);
  if (!filters) return base;

  let filteredLogs = base.logs;
  if (filters.action && filters.action !== "all") {
    filteredLogs = filteredLogs.filter((l) => l.action === filters.action);
  }
  if (filters.actorEmail && filters.actorEmail.trim().length > 0) {
    const em = filters.actorEmail.trim().toLowerCase();
    filteredLogs = filteredLogs.filter((l) => l.actorEmail.toLowerCase().includes(em));
  }
  return {
    summary: base.summary,
    logs: filteredLogs,
  };
});
