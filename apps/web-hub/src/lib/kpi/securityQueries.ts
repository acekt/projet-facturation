import { createClient } from "@/utils/supabase/server";
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
 * Récupère le journal d'audit immuable du Hub Web Super Admin.
 */
export async function getSecurityAuditLogs(filters?: {
  action?: string;
  actorEmail?: string;
  limit?: number;
}): Promise<SecurityAuditOverviewData> {
  await requireSuperadmin();
  const supabase = await createClient();

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
    .limit(filters?.limit || 200);

  if (filters?.action && filters.action !== "all") {
    query = query.eq("action", filters.action);
  }

  if (filters?.actorEmail && filters.actorEmail.trim().length > 0) {
    query = query.ilike("actor_email", `%${filters.actorEmail.trim()}%`);
  }

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
