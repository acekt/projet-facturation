"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { requireSuperadmin } from "@/lib/auth/dal";
import { logHubAudit } from "@/lib/audit";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Création d'une nouvelle entreprise cliente par le Super Admin.
 */
export async function createTenantAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  await requireSuperadmin();
  const supabase = await createClient();

  const name = (formData.get("name") as string)?.trim();
  const country = (formData.get("country") as string)?.trim() || "Cameroun";
  const planId = (formData.get("planId") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!name || name.length < 2) {
    return { success: false, error: "La raison sociale de l'entreprise est obligatoire (2 car. min)." };
  }

  // 1. Insertion du tenant
  const { data: tenantData, error: tenantErr } = await supabase
    .from("tenants")
    .insert({
      name,
      country,
      status: "active",
      plan_id: planId || undefined,
      notes,
    })
    .select("id")
    .single();

  if (tenantErr || !tenantData) {
    return { success: false, error: `Échec création du tenant : ${tenantErr?.message}` };
  }

  // 2. Journalisation d'audit immuable
  await logHubAudit({
    action: "tenant.create",
    targetType: "tenant",
    targetId: tenantData.id,
    tenantId: tenantData.id,
    reason: "Création manuelle Super Admin",
    metadata: { name, country, planId },
  });

  revalidatePath("/admin/tenants");
  return { success: true, data: { id: tenantData.id } };
}

/**
 * Suspension ou Réactivation administrative immédiate d'un tenant.
 * La suspension sera immédiatement appliquée par le Desktop au prochain cycle de réplication.
 */
export async function toggleTenantStatusAction(params: {
  tenantId: string;
  status: "active" | "suspended";
  reason?: string;
}): Promise<ActionResult> {
  await requireSuperadmin();
  const supabase = await createClient();

  if (params.status === "suspended" && (!params.reason || params.reason.trim().length < 5)) {
    return { success: false, error: "Un motif de suspension clair est obligatoire (5 caractères min)." };
  }

  const { error } = await supabase
    .from("tenants")
    .update({
      status: params.status,
      suspended_reason: params.status === "suspended" ? params.reason : null,
      suspended_at: params.status === "suspended" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.tenantId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Traçabilité Super Admin
  await logHubAudit({
    action: params.status === "suspended" ? "tenant.suspend" : "tenant.reactivate",
    targetType: "tenant",
    targetId: params.tenantId,
    tenantId: params.tenantId,
    reason: params.reason || (params.status === "active" ? "Régularisation administrative" : null),
    metadata: { newStatus: params.status },
  });

  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${params.tenantId}`);
  return { success: true };
}

/**
 * Changement de plan tarifaire d'un tenant.
 */
export async function updateTenantPlanAction(params: {
  tenantId: string;
  planId: string;
}): Promise<ActionResult> {
  await requireSuperadmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tenants")
    .update({
      plan_id: params.planId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.tenantId);

  if (error) {
    return { success: false, error: error.message };
  }

  await logHubAudit({
    action: "tenant.update_plan",
    targetType: "tenant",
    targetId: params.tenantId,
    tenantId: params.tenantId,
    reason: "Mise à niveau ou changement de plan",
    metadata: { newPlanId: params.planId },
  });

  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${params.tenantId}`);
  return { success: true };
}

/**
 * Mise à jour des notes internes confidentielles du Super Admin.
 */
export async function updateTenantNotesAction(params: {
  tenantId: string;
  notes: string;
}): Promise<ActionResult> {
  await requireSuperadmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tenants")
    .update({
      notes: params.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.tenantId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/admin/tenants/${params.tenantId}`);
  return { success: true };
}

/**
 * Déclenchement d'un accès de support exceptionnel « Bris de Glace » (D9).
 * Conditionné par un motif impératif (ex: incident n°1234, demande écrite client),
 * strictement en lecture seule, et consigné de façon inviolable dans hub_audit_logs.
 */
export async function breakGlassAccessAction(params: {
  tenantId: string;
  reason: string;
}): Promise<ActionResult<{ authorizedUntil: string }>> {
  await requireSuperadmin();

  const reason = params.reason?.trim();
  if (!reason || reason.length < 10) {
    return {
      success: false,
      error: "Le protocole de Bris de Glace requiert impérativement un motif circonstancié (10 caractères min, ticket ou référence incident).",
    };
  }

  const authorizedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 heure de validité

  const auditId = await logHubAudit({
    action: "tenant.break_glass_access",
    targetType: "tenant",
    targetId: params.tenantId,
    tenantId: params.tenantId,
    reason: reason,
    metadata: {
      mode: "READ_ONLY_SUPPORT",
      expiresAt: authorizedUntil,
      scope: ["invoices", "quotes", "clients", "payments"],
    },
  });

  if (!auditId) {
    return {
      success: false,
      error: "Échec de l'enregistrement d'audit obligatoire. Accès bris de glace refusé par mesure de sécurité.",
    };
  }

  revalidatePath(`/admin/tenants/${params.tenantId}`);
  return { success: true, data: { authorizedUntil } };
}
