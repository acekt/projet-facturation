"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireSuperadmin } from "@/lib/auth/dal";
import { logHubAudit } from "@/lib/audit";

export interface PlanDetail {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceXaf: number;
  billingPeriod: string;
  maxUsers: number;
  maxDevices: number;
  features: Record<string, any>;
  isActive: boolean;
  subscribersCount: number;
  totalRevenueXaf: number;
}

export interface ExpiringTenantLicense {
  tenantId: string;
  tenantName: string;
  planName: string;
  status: string;
  licenseExpiresAt: string | null;
  daysRemaining: number;
}

export interface PlansAndLicencesData {
  summary: {
    totalPlans: number;
    activeSubscribers: number;
    expiringCount: number;
    mrrTotalXaf: number;
  };
  plans: PlanDetail[];
  expiringLicenses: ExpiringTenantLicense[];
}

/**
 * Récupère le catalogue des plans d'abonnement et la veille des licences expirantes.
 */
export async function getPlansAndLicences(): Promise<PlansAndLicencesData> {
  await requireSuperadmin();
  const supabase = createAdminClient();

  const now = Date.now();
  const d30Ahead = now + 30 * 24 * 60 * 60 * 1000;

  // 1 & 2. Récupération simultanée des plans et des tenants avec Service Role
  const [{ data: plansData }, { data: tenantsData }] = await Promise.all([
    supabase
      .from("plans")
      .select("*")
      .order("price_xaf", { ascending: true }),
    supabase
      .from("tenants")
      .select(`
        id,
        name,
        status,
        plan_id,
        license_expires_at,
        trial_ends_at,
        plans (
          id,
          name,
          price_xaf
        )
      `),
  ]);

  const rawPlans = plansData || [];
  const rawTenants = tenantsData || [];

  const subscribersByPlan = new Map<string, number>();
  const expiringLicenses: ExpiringTenantLicense[] = [];
  let mrrTotalXaf = 0;
  let activeSubscribers = 0;

  rawTenants.forEach((t: any) => {
    const status = (t.status || "active").toLowerCase();
    const planId = t.plan_id;

    if (status === "active" || status === "trial") {
      activeSubscribers++;
      if (planId) {
        subscribersByPlan.set(planId, (subscribersByPlan.get(planId) || 0) + 1);
      }
      if (status === "active" && t.plans?.price_xaf) {
        mrrTotalXaf += Number(t.plans.price_xaf);
      }
    }

    // Analyse d'échéance de licence
    const expiryStr = t.license_expires_at || t.trial_ends_at;
    if (expiryStr) {
      const expiryMs = new Date(expiryStr).getTime();
      const diffDays = Math.ceil((expiryMs - now) / (24 * 3600 * 1000));
      if (expiryMs <= d30Ahead) {
        expiringLicenses.push({
          tenantId: t.id,
          tenantName: t.name || "Entreprise",
          planName: t.plans?.name || "Sans abonnement",
          status,
          licenseExpiresAt: expiryStr,
          daysRemaining: diffDays,
        });
      }
    }
  });

  const plans: PlanDetail[] = rawPlans.map((p: any) => {
    const subs = subscribersByPlan.get(p.id) || 0;
    const price = Number(p.price_xaf) || 0;
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      priceXaf: price,
      billingPeriod: p.billing_period || "monthly",
      maxUsers: Number(p.max_users) || 5,
      maxDevices: Number(p.max_devices) || 3,
      features: p.features || {},
      isActive: p.is_active ?? true,
      subscribersCount: subs,
      totalRevenueXaf: subs * price,
    };
  });

  expiringLicenses.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    summary: {
      totalPlans: plans.length,
      activeSubscribers,
      expiringCount: expiringLicenses.length,
      mrrTotalXaf,
    },
    plans,
    expiringLicenses,
  };
}

/**
 * Prolonge la licence d'un tenant et journalise l'audit.
 */
export async function extendLicenseAction(
  tenantId: string,
  daysToAdd: number,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireSuperadmin();
    const supabase = await createClient();

    if (!tenantId) return { success: false, error: "Identifiant tenant manquant." };
    if (!daysToAdd || daysToAdd <= 0) return { success: false, error: "Nombre de jours invalide." };
    if (!reason || reason.trim().length < 5) {
      return { success: false, error: "Le motif doit comporter au moins 5 caractères." };
    }

    const { data: tenant, error: fetchErr } = await supabase
      .from("tenants")
      .select("id, name, license_expires_at, status")
      .eq("id", tenantId)
      .single();

    if (fetchErr || !tenant) {
      return { success: false, error: "Tenant introuvable." };
    }

    const currentExpiry = tenant.license_expires_at
      ? new Date(tenant.license_expires_at).getTime()
      : Date.now();

    const baseMs = Math.max(Date.now(), currentExpiry);
    const newExpiryDate = new Date(baseMs + daysToAdd * 24 * 3600 * 1000).toISOString();

    const updatePayload: Record<string, any> = {
      license_expires_at: newExpiryDate,
    };
    if (tenant.status === "expired" || tenant.status === "suspended") {
      updatePayload.status = "active";
    }

    const { error: updateErr } = await supabase
      .from("tenants")
      .update(updatePayload)
      .eq("id", tenantId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    await logHubAudit({
      action: "LICENSE_EXTEND",
      targetType: "tenant",
      targetId: tenantId,
      tenantId,
      reason,
      metadata: {
        daysAdded: daysToAdd,
        previousExpiry: tenant.license_expires_at,
        newExpiry: newExpiryDate,
      },
    });

    revalidatePath("/admin/licences");
    revalidatePath("/admin/tenants");
    revalidatePath(`/admin/tenants/${tenantId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur serveur inattendue." };
  }
}

/**
 * Crée un nouveau plan d'abonnement SaaS.
 */
export async function createPlanAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireSuperadmin();
    const supabase = await createClient();

    const code = String(formData.get("code") || "").trim().toLowerCase();
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const priceXaf = Number(formData.get("priceXaf")) || 0;
    const maxUsers = Number(formData.get("maxUsers")) || 5;
    const maxDevices = Number(formData.get("maxDevices")) || 3;
    const billingPeriod = String(formData.get("billingPeriod") || "monthly");

    if (!code || code.length < 3) return { success: false, error: "Code plan invalide (3 car. min)." };
    if (!name || name.length < 3) return { success: false, error: "Nom du plan requis (3 car. min)." };

    const { error: insertErr } = await supabase.from("plans").insert({
      code,
      name,
      description: description || null,
      price_xaf: priceXaf,
      billing_period: billingPeriod,
      max_users: maxUsers,
      max_devices: maxDevices,
      features: { sync: true, multi_device: true, export_csv: true },
      is_active: true,
    });

    if (insertErr) {
      return { success: false, error: insertErr.message };
    }

    await logHubAudit({
      action: "PLAN_CREATE",
      targetType: "system",
      targetId: code,
      reason: "Création administrative d'un nouveau plan SaaS",
      metadata: { code, name, priceXaf, maxUsers, maxDevices },
    });

    revalidatePath("/admin/licences");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur serveur inattendue." };
  }
}
