import { createClient } from "@/utils/supabase/server";
import { forbidden, redirect } from "next/navigation";

export interface SuperadminSession {
  user: {
    id: string;
    email?: string;
  };
  profile: {
    id: string;
    role: string;
    fullName?: string | null;
    email?: string | null;
    isActive: boolean;
    tenantId?: string | null;
  };
  aal: {
    currentLevel: string | null;
    nextLevel: string | null;
    currentAuthenticationMethods: unknown[];
  } | null;
}

/**
 * Data Access Layer (DAL) : Exige formellement une session Super Admin valide.
 * Si l'utilisateur n'est pas connecté -> redirection /login.
 * Si le rôle n'est pas superadmin -> déclenche forbidden() (403 HTTP).
 * Si un second facteur TOTP est enrôlé mais non vérifié (aal1 -> aal2) -> redirection /mfa/verify.
 */
export async function requireSuperadmin(): Promise<SuperadminSession> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // 1. Double vérification du rôle : profiles en base + claims JWT (défense en profondeur)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, is_active, tenant_id")
    .eq("id", user.id)
    .single();

  const rawRole = (
    profile?.role ||
    (user.app_metadata?.user_role as string) ||
    ""
  ).toLowerCase();

  const allowedSuperadminEmails = (process.env.SUPERADMIN_EMAILS || "admin@facturier.cloud")
    .split(",")
    .map((e) => e.trim().toLowerCase());

  const isSuperadmin =
    rawRole === "superadmin" || 
    rawRole === "super_admin" ||
    Boolean(user.email && allowedSuperadminEmails.includes(user.email.toLowerCase()));

  if (profileError || !isSuperadmin || profile?.is_active === false) {
    // Interruption stricte 403
    forbidden();
  }

  // 2. Vérification MFA (TOTP Assurance Level)
  const { data: aalData } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (
    aalData &&
    aalData.nextLevel === "aal2" &&
    aalData.currentLevel !== "aal2"
  ) {
    redirect("/mfa/verify");
  }

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile: {
      id: profile.id,
      role: isSuperadmin ? "superadmin" : profile.role,
      fullName: profile.full_name,
      email: profile.email,
      isActive: profile.is_active,
      tenantId: profile.tenant_id,
    },
    aal: aalData,
  };
}

/**
 * Vérification non-bloquante du statut Super Admin (pour affichage conditionnel).
 */
export async function getCurrentSuperadmin(): Promise<SuperadminSession | null> {
  try {
    return await requireSuperadmin();
  } catch {
    return null;
  }
}
