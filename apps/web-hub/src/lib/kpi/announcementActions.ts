"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { requireSuperadmin } from "@/lib/auth/dal";
import { logHubAudit } from "@/lib/audit";

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  level: "info" | "warning" | "maintenance" | "critical";
  targetTenantId: string | null;
  targetTenantName: string | null;
  isActive: boolean;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
}

export interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  status: "open" | "acknowledged" | "resolved";
  tenantId: string | null;
  tenantName: string | null;
  ruleName: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AnnouncementsAndAlertsData {
  summary: {
    activeAnnouncements: number;
    openAlerts: number;
    criticalAlerts: number;
    totalAlerts: number;
  };
  announcements: AnnouncementItem[];
  alerts: AlertItem[];
  tenants: Array<{ id: string; name: string }>;
}

/**
 * Récupère la liste des annonces broadcast et le flux des alertes de supervision.
 */
export async function getAnnouncementsAndAlerts(): Promise<AnnouncementsAndAlertsData> {
  await requireSuperadmin();
  const supabase = await createClient();

  // 1. Récupération des annonces
  const { data: rawAnnouncements } = await supabase
    .from("announcements")
    .select(`
      id,
      title,
      body,
      level,
      target_tenant_id,
      is_active,
      starts_at,
      ends_at,
      created_at,
      tenants (
        name
      )
    `)
    .order("created_at", { ascending: false });

  // 2. Récupération des alertes
  const { data: rawAlerts } = await supabase
    .from("alerts")
    .select(`
      id,
      title,
      message,
      severity,
      status,
      tenant_id,
      created_at,
      resolved_at,
      tenants (
        name
      ),
      alert_rules (
        name
      )
    `)
    .order("created_at", { ascending: false });

  let activeAnnouncements = 0;
  const announcements: AnnouncementItem[] = (rawAnnouncements || []).map((a: any) => {
    if (a.is_active) activeAnnouncements++;
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      level: a.level,
      targetTenantId: a.target_tenant_id,
      targetTenantName: a.tenants?.name || "Tous les tenants (Global)",
      isActive: a.is_active,
      startsAt: a.starts_at,
      endsAt: a.ends_at,
      createdAt: a.created_at,
    };
  });

  let openAlerts = 0;
  let criticalAlerts = 0;

  const alerts: AlertItem[] = (rawAlerts || []).map((alt: any) => {
    if (alt.status === "open") {
      openAlerts++;
      if (alt.severity === "critical") criticalAlerts++;
    }
    return {
      id: alt.id,
      title: alt.title,
      message: alt.message,
      severity: alt.severity,
      status: alt.status,
      tenantId: alt.tenant_id,
      tenantName: alt.tenants?.name || null,
      ruleName: alt.alert_rules?.name || null,
      createdAt: alt.created_at,
      resolvedAt: alt.resolved_at,
    };
  });

  // 3. Récupération des tenants pour la liste déroulante de ciblage
  const { data: rawTenants } = await supabase
    .from("tenants")
    .select("id, name")
    .order("name", { ascending: true });

  const tenants = (rawTenants || []).map((t: any) => ({
    id: t.id,
    name: t.name || "Entreprise",
  }));

  return {
    summary: {
      activeAnnouncements,
      openAlerts,
      criticalAlerts,
      totalAlerts: alerts.length,
    },
    announcements,
    alerts,
    tenants,
  };
}

/**
 * Diffuse une nouvelle annonce broadcast aux terminaux Desktop.
 */
export async function createAnnouncementAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireSuperadmin();
    const supabase = await createClient();

    const title = String(formData.get("title") || "").trim();
    const body = String(formData.get("body") || "").trim();
    const level = (formData.get("level") || "info") as any;
    const targetTenantId = String(formData.get("targetTenantId") || "").trim() || null;
    const endsAt = String(formData.get("endsAt") || "").trim() || null;

    if (!title || title.length < 3) return { success: false, error: "Titre requis (3 car. min)." };
    if (!body || body.length < 5) return { success: false, error: "Contenu de l'annonce requis (5 car. min)." };

    const { data: inserted, error: insertErr } = await supabase
      .from("announcements")
      .insert({
        title,
        body,
        level,
        target_tenant_id: targetTenantId,
        is_active: true,
        ends_at: endsAt,
      })
      .select("id")
      .single();

    if (insertErr) {
      return { success: false, error: insertErr.message };
    }

    await logHubAudit({
      action: "ANNOUNCEMENT_CREATE",
      targetType: "system",
      targetId: inserted?.id,
      tenantId: targetTenantId,
      reason: `Diffusion annonce [${level.toUpperCase()}]: ${title}`,
      metadata: { title, level, targetTenantId, endsAt },
    });

    revalidatePath("/admin/announcements");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur serveur inattendue." };
  }
}

/**
 * Active ou désactive une annonce.
 */
export async function toggleAnnouncementAction(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireSuperadmin();
    const supabase = await createClient();

    const { error: updateErr } = await supabase
      .from("announcements")
      .update({ is_active: isActive })
      .eq("id", id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    await logHubAudit({
      action: isActive ? "ANNOUNCEMENT_ACTIVATE" : "ANNOUNCEMENT_DEACTIVATE",
      targetType: "system",
      targetId: id,
      reason: `Bascule statut annonce vers ${isActive ? "actif" : "inactif"}`,
    });

    revalidatePath("/admin/announcements");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur serveur inattendue." };
  }
}

/**
 * Prend en charge ou clôture une alerte système.
 */
export async function resolveAlertAction(
  alertId: string,
  newStatus: "acknowledged" | "resolved"
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireSuperadmin();
    const supabase = await createClient();

    const updatePayload: Record<string, any> = {
      status: newStatus,
    };
    if (newStatus === "resolved") {
      updatePayload.resolved_at = new Date().toISOString();
    }

    const { error: updateErr } = await supabase
      .from("alerts")
      .update(updatePayload)
      .eq("id", alertId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    await logHubAudit({
      action: `ALERT_${newStatus.toUpperCase()}`,
      targetType: "system",
      targetId: alertId,
      reason: `Mise à jour statut alerte : ${newStatus}`,
    });

    revalidatePath("/admin/announcements");
    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur serveur inattendue." };
  }
}
