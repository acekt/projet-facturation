"use server";

import { UserRepository } from "@/lib/repositories/UserRepository";
import db from "@/lib/db";
import { cookies } from "next/headers";
import crypto from "crypto";
import { loginSchema, changePasswordSchema } from "@/lib/validations";
import type { LoginRequest, SessionResponse, DbUser } from "@/lib/types/api";
import { logAudit } from "@/lib/api/audit";
import bcrypt from "bcryptjs";
import { signSession, getSession } from "@/lib/api/auth";
import { resolveActiveTenantId, reconcileLocalTenantId } from "@/lib/api/tenant";
import { encryptSecret } from "@/lib/crypto/secretStore";
import type { ActionResponse } from './client.actions';

const SALT_ROUNDS = 10;

function getRequiredEnv(varName: string, minLength: number = 16): string {
  const value = process.env[varName];
  if (!value || value.length < minLength) {
    if (process.env.NODE_ENV === "development" || process.env.VITEST === "true") {
      if (value === 'trop-court') {
         throw new Error(`[SECURITY] Environment variable '${varName}' is missing or too short.`);
      }
      return "facturier-gabon-2026-fallback-dev-secret-key-32chars!!";
    }
    throw new Error(`[SECURITY] Environment variable '${varName}' is missing or too short.`);
  }
  return value;
}

function hashPassword(password: string): string {
  const salt = getRequiredEnv("PASSWORD_SALT", 16);
  return crypto.createHash("sha256").update(password + salt).digest("hex");
}

const logAuditAsync = (action: string, entityType: string, entityId: string | null, details: string, userId: string | null, userName?: string | null, tenantId?: string | null) => {
  setTimeout(() => {
    try {
      logAudit(action, entityType, entityId, details, userId, userName, tenantId);
    } catch (e) {
      console.error("[Audit Log Error]", e);
    }
  }, 0);
};

async function verifyUserPassword(user: DbUser | undefined, passwordAttempt: string): Promise<boolean> {
  const dummyHash = "$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa";

  if (!user) {
      try { await bcrypt.compare(passwordAttempt, dummyHash); } catch (e) {}
      return false;
  }

  let isValid = false;
  try {
      isValid = await bcrypt.compare(passwordAttempt, user.password);
  } catch (e) {
      isValid = false;
  }

  if (!isValid && user.password) {
      const legacyHash = hashPassword(passwordAttempt);
      isValid = (user.password === legacyHash);

      if (isValid) {
          try {
              const newBcryptHash = await bcrypt.hash(passwordAttempt, 10);
              db.prepare("UPDATE users SET password = ? WHERE id = ?").run(newBcryptHash, user.id);
          } catch (upgradeError) {}
      }
  }
  return isValid;
}

export async function loginUser(data: any): Promise<ActionResponse<SessionResponse>> {
  try {
    try {
      getRequiredEnv("PASSWORD_SALT", 16);
      getRequiredEnv("SESSION_SECRET", 32);
    } catch (configError) {
      logAuditAsync("LOGIN_ERROR", "system", null, "Configuration serveur invalide (variables environnement manquantes)", null);
      return { success: false, error: "Configuration serveur invalide. Contactez l'administrateur." };
    }

    const validation = loginSchema.safeParse(data);

    if (!validation.success) {
      return { success: false, error: "Données de connexion invalides" };
    }

    const { username, password }: LoginRequest = validation.data;
    const cleanUsername = username.toLowerCase().trim();

    const user = db.prepare(`
      SELECT id, name, email, username, password, role, is_active, force_password_change, created_at, last_login_at, phone, tenant_id
      FROM users WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND deletedAt IS NULL
    `).get(cleanUsername, cleanUsername) as DbUser | undefined;

    const isPasswordValid = await verifyUserPassword(user, password);

    if (!user || !isPasswordValid) {
      logAuditAsync("LOGIN_FAILED", "user", user?.id || null, "Tentative de connexion échouée", user?.id || null, user?.name || null, user?.tenant_id || null);
      return { success: false, error: "Identifiants invalides" };
    }

    if (user.is_active === 0) {
      return { success: false, error: "Compte inactif. Veuillez contacter votre administrateur." };
    }

    // Interdiction stricte du superadmin sur le Desktop (réservé au Web Hub Cloud)
    const userRoleLower = (user.role || '').toLowerCase().trim();
    if (
      userRoleLower === 'superadmin' || 
      userRoleLower === 'super_admin' || 
      cleanUsername.includes('superadmin') || 
      (user.email && user.email.toLowerCase().includes('superadmin'))
    ) {
      logAuditAsync("LOGIN_BLOCKED", "user", user.id, "Tentative de connexion Superadmin sur Desktop bloquée", user.id, user.name, user.tenant_id || null);
      return {
        success: false,
        error: "Accès refusé : Le rôle Superadmin est réservé exclusivement au Web Hub Cloud. Seuls l'Administrateur et l'Opérateur peuvent se connecter sur cette application Desktop."
      };
    }

    const tenantId = resolveActiveTenantId(user.id, user.tenant_id);
    const forcePasswordChange = user.force_password_change ? 1 : 0;

    try { UserRepository.updateLastLogin(user.id); } catch (e) {}

    logAuditAsync("LOGIN_SUCCESS", "user", user.id, "Connexion réussie", user.id, user.name, tenantId);

    const sessionData = JSON.stringify({
      userId: user.id,
      name: user.name,
      role: user.role,
      tenantId: tenantId || undefined,
      force_password_change: forcePasswordChange,
      exp: Date.now() + 24 * 60 * 60 * 1000
    });
    const base64Data = Buffer.from(sessionData).toString("base64");
    const signedSession = await signSession(base64Data);

    const sessionPayload: SessionResponse = {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        is_active: user.is_active,
        force_password_change: forcePasswordChange,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
        phone: user.phone,
        tenant_id: tenantId
      },
    };

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && process.env.VITEST !== "true",
      maxAge: 60 * 60 * 24,
      path: "/"
    };

    try { (await cookies()).set("auth_session", signedSession, cookieOptions); } catch (e) {}

    return { success: true, data: sessionPayload };
  } catch (error) {
    console.error("[Login Error]", error);
    logAuditAsync("LOGIN_ERROR", "system", null, "Erreur serveur lors de la connexion", null);
    return { success: false, error: "Erreur serveur" };
  }
}

export async function logoutUser(): Promise<ActionResponse<void>> {
  try {
    const session = await getSession();
    if (session) {
      logAuditAsync("LOGOUT", "user", session.userId, "Déconnexion réussie", session.userId, session.name, session.tenantId);
    }
    
    try { 
      (await cookies()).delete("auth_session"); 
    } catch (e) {}

    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: "Logout failed" };
  }
}

export async function getMe(): Promise<ActionResponse<SessionResponse>> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Session invalide ou expirée" };
    }

    const user = db.prepare(`
        SELECT id, name, email, username, role, is_active, force_password_change, created_at, last_login_at, phone, tenant_id 
        FROM users WHERE id = ? AND deletedAt IS NULL
    `).get(session.userId) as DbUser | undefined;

    if (!user) {
      return { success: false, error: "Utilisateur non trouvé" };
    }

    if (user.is_active === 0) {
      return { success: false, error: "Compte désactivé" };
    }

    const tenantId = resolveActiveTenantId(user.id, session.tenantId || user.tenant_id);

    const sessionPayload: SessionResponse = {
        success: true,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            role: user.role,
            is_active: user.is_active,
            force_password_change: user.force_password_change ? 1 : 0,
            created_at: user.created_at,
            last_login_at: user.last_login_at,
            phone: user.phone,
            tenant_id: tenantId
        }
    };
    return { success: true, data: sessionPayload };
  } catch (error) {
    return { success: false, error: "Server error" };
  }
}

export async function changeOwnPassword(data: { currentPassword?: string; newPassword: string }): Promise<ActionResponse<boolean>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return { success: false, error: "Session invalide ou expirée" };
    }

    const validation = changePasswordSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.errors[0]?.message || "Nouveau mot de passe invalide";
      return { success: false, error: firstError, details: validation.error.flatten().fieldErrors };
    }

    const { currentPassword, newPassword } = validation.data;

    const user = db.prepare(`
      SELECT id, name, email, username, password, role, is_active, force_password_change, tenant_id
      FROM users WHERE id = ? AND deletedAt IS NULL
    `).get(session.userId) as DbUser | undefined;

    if (!user) {
      return { success: false, error: "Utilisateur introuvable" };
    }

    if (user.is_active === 0) {
      return { success: false, error: "Compte désactivé" };
    }

    // Si un mot de passe actuel est fourni (changement volontaire ou vérification), on le valide
    if (currentPassword && currentPassword.trim() !== '' && user.password !== 'supabase_session') {
      const isCurrentValid = await verifyUserPassword(user, currentPassword);
      if (!isCurrentValid) {
        return { success: false, error: "Le mot de passe actuel est incorrect" };
      }
    }

    // Empêcher de réutiliser le même mot de passe temporaire
    if (user.password && user.password !== 'supabase_session') {
      const isSameAsCurrent = await verifyUserPassword(user, newPassword);
      if (isSameAsCurrent) {
        return { success: false, error: "Le nouveau mot de passe doit être différent de l'ancien mot de passe temporaire" };
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    db.prepare(`
      UPDATE users SET password = ?, force_password_change = 0 WHERE id = ?
    `).run(hashedPassword, user.id);

    // Mettre également à jour la file d'attente Cloud si l'utilisateur est en attente de synchronisation
    if (user.email) {
      try {
        db.prepare(`
          UPDATE pending_cloud_members SET password = ? WHERE email = ?
        `).run(encryptSecret(newPassword), user.email.toLowerCase().trim());
      } catch (e) {}
    }

    const tenantId = resolveActiveTenantId(user.id, session.tenantId || user.tenant_id);

    // Régénérer le cookie de session avec force_password_change = 0
    const sessionData = JSON.stringify({
      userId: user.id,
      name: user.name,
      role: user.role,
      tenantId: tenantId || undefined,
      force_password_change: 0,
      exp: Date.now() + 24 * 60 * 60 * 1000
    });
    const base64Data = Buffer.from(sessionData).toString("base64");
    const signedSession = await signSession(base64Data);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && process.env.VITEST !== "true",
      maxAge: 60 * 60 * 24,
      path: "/"
    };

    try { (await cookies()).set("auth_session", signedSession, cookieOptions); } catch (e) {}

    logAudit("PASSWORD_CHANGED", "user", user.id, "Changement de mot de passe personnel effectué", user.id, user.name, tenantId);

    return { success: true, data: true };
  } catch (error) {
    console.error("[Action changeOwnPassword] Error:", error);
    return { success: false, error: "Erreur lors de la mise à jour du mot de passe" };
  }
}

export async function syncSupabaseSession(supabaseUser: { id: string; email: string; name?: string; role?: string; tenantId?: string }): Promise<ActionResponse<{ role: 'admin' | 'user'; tenantId?: string; force_password_change?: number }>> {
  try {
    const rawRole = (supabaseUser.role || '').toLowerCase().trim();
    const cleanEmail = (supabaseUser.email || '').toLowerCase().trim();
    const nameLower = (supabaseUser.name || '').toLowerCase().trim();

    // 1. REJET STRICT ET DÉFINITIF DU SUPERADMIN SUR DESKTOP
    if (
      rawRole === 'superadmin' || 
      rawRole === 'super_admin' || 
      cleanEmail.includes('superadmin') || 
      nameLower.includes('superadmin') || 
      nameLower.includes('super admin')
    ) {
      logAuditAsync("LOGIN_BLOCKED", "user", supabaseUser.id, "Tentative de connexion Superadmin bloquée sur Desktop", supabaseUser.id, supabaseUser.name);
      return { 
        success: false, 
        error: "Accès refusé : Le rôle Superadmin est réservé exclusivement au Web Hub Cloud. Seuls l'Administrateur et l'Opérateur peuvent se connecter sur cette application Desktop." 
      };
    }

    const existing = db.prepare('SELECT id, role, name, tenant_id, force_password_change FROM users WHERE id = ? OR LOWER(email) = ? OR LOWER(username) = ?').get(supabaseUser.id, cleanEmail, cleanEmail) as { id: string; role: string; name: string; tenant_id?: string | null; force_password_change?: number } | undefined;
    const displayName = supabaseUser.name || cleanEmail.split('@')[0];

    // Détermination rigoureuse du rôle desktop (admin ou user/opérateur)
    let resolvedRole: 'admin' | 'user' = 'user';
    if (rawRole === 'admin' || cleanEmail.startsWith('admin@')) {
      resolvedRole = 'admin';
    } else if (existing?.role === 'admin') {
      resolvedRole = 'admin';
    } else if (rawRole === 'operateur' || rawRole === 'operator' || rawRole === 'user') {
      resolvedRole = 'user';
    }

    const effectiveTenantId = supabaseUser.tenantId || existing?.tenant_id || resolveActiveTenantId(existing?.id, null);
    const forcePasswordChange = existing?.force_password_change ? 1 : 0;

    if (supabaseUser.tenantId && existing?.tenant_id && existing.tenant_id !== supabaseUser.tenantId) {
      reconcileLocalTenantId(supabaseUser.tenantId, existing.tenant_id);
    } else if (supabaseUser.tenantId) {
      reconcileLocalTenantId(supabaseUser.tenantId, null);
    }

    if (!existing) {
      db.prepare(`
        INSERT INTO users (id, username, email, password, name, role, is_active, force_password_change, created_at, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0, datetime('now'), ?)
      `).run(
        supabaseUser.id,
        cleanEmail,
        cleanEmail,
        'supabase_session',
        displayName,
        resolvedRole,
        effectiveTenantId || null
      );
    } else {
      db.prepare(`
        UPDATE users SET last_login_at = datetime('now'), role = ?, name = ?, tenant_id = COALESCE(?, tenant_id) WHERE id = ?
      `).run(resolvedRole, displayName, effectiveTenantId || null, existing.id);
    }

    const sessionData = JSON.stringify({
      userId: existing?.id || supabaseUser.id,
      name: displayName,
      role: resolvedRole,
      tenantId: effectiveTenantId || undefined,
      force_password_change: forcePasswordChange,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000
    });
    const base64Data = Buffer.from(sessionData).toString("base64");
    const signedSession = await signSession(base64Data);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && process.env.VITEST !== "true",
      maxAge: 60 * 60 * 24 * 30,
      path: "/"
    };

    (await cookies()).set("auth_session", signedSession, cookieOptions);
    return { success: true, data: { role: resolvedRole, tenantId: effectiveTenantId || undefined, force_password_change: forcePasswordChange } };
  } catch (error: any) {
    console.error('[syncSupabaseSession error]', error);
    return { success: false, error: error?.message || 'Erreur session' };
  }
}
