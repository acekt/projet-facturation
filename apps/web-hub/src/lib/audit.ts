import { createClient } from "@/utils/supabase/server";

export interface LogHubAuditParams {
  action: string;
  targetType: "tenant" | "user" | "sync_fleet" | "system" | "security";
  targetId?: string | null;
  tenantId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Enregistre une action sensible du Super Admin dans le journal immuable hub_audit_logs.
 * Utilise la RPC sécurisée log_hub_action en priorité, avec fallback en insertion directe.
 */
export async function logHubAudit(params: LogHubAuditParams): Promise<string | null> {
  try {
    const supabase = await createClient();

    // 1. Appel via la RPC PostgreSQL
    const { data: rpcLogId, error: rpcError } = await supabase.rpc(
      "log_hub_action",
      {
        p_action: params.action,
        p_target_type: params.targetType,
        p_target_id: params.targetId || null,
        p_tenant_id: params.tenantId || null,
        p_reason: params.reason || null,
        p_metadata: params.metadata || {},
        p_ip: params.ipAddress || null,
        p_user_agent: params.userAgent || null,
      }
    );

    if (!rpcError && rpcLogId) {
      return rpcLogId as string;
    }

    // 2. Repli en insertion directe si la fonction RPC n'est pas encore créée
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn("[hub-audit] Impossible de tracer l'action : aucun utilisateur connecté");
      return null;
    }

    const { data: insertData, error: insertError } = await supabase
      .from("hub_audit_logs")
      .insert({
        actor_id: user.id,
        actor_email: user.email || "superadmin@hub",
        action: params.action,
        target_type: params.targetType,
        target_id: params.targetId,
        tenant_id: params.tenantId,
        reason: params.reason,
        metadata: params.metadata || {},
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[hub-audit] Erreur d'enregistrement d'audit :", insertError.message);
      return null;
    }

    return insertData?.id || null;
  } catch (error) {
    console.error("[hub-audit] Exception lors du journal d'audit :", error);
    return null;
  }
}
