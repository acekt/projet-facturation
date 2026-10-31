"use server";

import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import { buildTenantFilter, resolveActiveTenantId } from '@/lib/api/tenant';
import db from '@/lib/db';
import { UserRepository } from '@/lib/repositories/UserRepository';
import bcrypt from 'bcryptjs';
import { enqueueCloudMember } from '@/lib/sync/cloudMembers';
import { encryptSecret } from '@/lib/crypto/secretStore';
import { userCreateSchema, userUpdateSchema } from '@/lib/validations';
import type { UserResponse } from '@/lib/types/api';
import type { ActionResponse } from './client.actions';
import { getErrorMessage } from '@/lib/utils/action-error';

const SALT_ROUNDS = 10;

export async function getUsers(): Promise<ActionResponse<UserResponse[]>> {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { success: false, error: 'Forbidden' };

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const users = UserRepository.findAllActive(activeTenantId);
    const userResponses: UserResponse[] = users.map((user): UserResponse => ({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      is_active: user.is_active,
      force_password_change: user.force_password_change ?? 0,
      created_at: user.created_at,
      last_login_at: user.last_login_at || undefined,
      phone: String(user.phone || ''),
      deletedAt: user.deletedAt || undefined,
      tenant_id: user.tenant_id || undefined,
    }));

    return { success: true, data: userResponses };
  } catch (error) {
    console.error('[Action getUsers] Error:', error);
    return { success: false, error: 'Failed to fetch users' };
  }
}

export async function createUser(data: any): Promise<ActionResponse<UserResponse>> {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { success: false, error: 'Forbidden' };
    if (!session.userId) return { success: false, error: 'User ID manquant dans la session' };

    const validation = userCreateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const { name, email, role, password, phone, is_active, force_password_change } = validation.data;
    const username = validation.data.username || '';

    const id = globalThis.crypto.randomUUID();
    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail = email?.toLowerCase().trim() || null;
    const cleanName = name.trim();
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const forcePasswordChangeInt = force_password_change ? 1 : 0;

    try {
      UserRepository.create({
        id,
        name: cleanName,
        email: cleanEmail || '',
        username: cleanUsername,
        password: hashedPassword,
        role: role,
        is_active: is_active ? 1 : 0,
        force_password_change: forcePasswordChangeInt,
        created_by: session.userId,
        phone: phone || undefined,
        tenant_id: activeTenantId,
      });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message?.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'Un utilisateur avec cet email ou identifiant existe déjà.' };
      }
      throw error;
    }

    // Compte Cloud mis en file : créé dès qu'une connexion + session admin Cloud sont disponibles.
    try {
      enqueueCloudMember({ email: cleanEmail || cleanUsername, password, name: cleanName, phone: phone || null, role });
    } catch (e) {
      console.warn('[Action createUser] File Cloud indisponible:', (e as Error)?.message);
    }

    logAudit('CREATE', 'user', id, `Nouvel utilisateur créé: ${cleanUsername} (${role})`, session.userId, session.name || session.username || null, activeTenantId);

    const userResponse: UserResponse = {
      id,
      name: cleanName,
      email: cleanEmail || '',
      username: cleanUsername as string,
      role,
      is_active: is_active ? 1 : 0,
      force_password_change: forcePasswordChangeInt,
      created_at: new Date().toISOString(),
      phone: phone || '',
      tenant_id: activeTenantId || undefined,
    };

    return { success: true, data: userResponse };
  } catch (error: unknown) {
    console.error('[Action createUser] Error:', error);
    const err = error as { code?: string; message?: string };
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message?.includes('UNIQUE constraint failed')) {
      return { success: false, error: 'Un utilisateur avec cet email ou identifiant existe déjà.' };
    }
    return { success: false, error: getErrorMessage(error, 'Failed to create user') };
  }
}

export async function updateUser(id: string, data: any): Promise<ActionResponse<boolean>> {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { success: false, error: 'Forbidden' };
    if (!session.userId) return { success: false, error: 'User ID manquant dans la session' };

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const tf = buildTenantFilter(activeTenantId);
    const targetUser = db.prepare(`SELECT id, email FROM users WHERE id = ?${tf.sql}`).get(id, ...tf.params) as { id: string; email?: string } | undefined;
    if (!targetUser) return { success: false, error: 'User not found' };

    const validation = userUpdateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const { name, email, role, is_active, password, phone, force_password_change } = validation.data;

    if (id === session.userId && role && role !== 'admin') {
      return { success: false, error: 'Impossible de rétrograder votre propre rôle administrateur' };
    }

    if (password && password !== '') {
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      const shouldForceChange = force_password_change !== undefined && force_password_change !== null ? (force_password_change ? 1 : 0) : 1;
      db.prepare('UPDATE users SET password = ?, force_password_change = ? WHERE id = ?').run(hashedPassword, shouldForceChange, id);
      const targetEmail = (email || targetUser.email || '').toLowerCase().trim();
      if (targetEmail) {
        try {
          db.prepare('UPDATE pending_cloud_members SET password = ? WHERE email = ?').run(encryptSecret(password), targetEmail);
        } catch (e) {}
      }
    } else if (force_password_change !== undefined && force_password_change !== null) {
      db.prepare('UPDATE users SET force_password_change = ? WHERE id = ?').run(force_password_change ? 1 : 0, id);
    }

    if (name !== undefined && role !== undefined) {
      if (email !== undefined && email !== null && email !== "") {
        db.prepare('UPDATE users SET name = ?, email = ?, role = ?, phone = ? WHERE id = ?').run(name, email, role, phone !== undefined && phone !== "" ? phone : null, id);
      } else {
        db.prepare('UPDATE users SET name = ?, role = ?, phone = ? WHERE id = ?').run(name, role, phone !== undefined && phone !== "" ? phone : null, id);
      }
    } else if (phone !== undefined) {
      db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone !== "" ? phone : null, id);
    }

    if (is_active !== undefined) {
      const isActiveInt = is_active ? 1 : 0;
      if (id === session.userId && isActiveInt === 0) {
        return { success: false, error: 'Impossible de désactiver votre propre compte' };
      }
      if (isActiveInt === 1) {
        db.prepare('UPDATE users SET is_active = 1, deletedAt = NULL WHERE id = ?').run(id);
      } else {
        db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(id);
      }
    }

    logAudit('UPDATE', 'user', id, `Utilisateur mis à jour: ${name || targetUser.email || id}`, session.userId, session.name || session.username || null, activeTenantId);
    return { success: true, data: true };
  } catch (error) {
    console.error('[Action updateUser] Error:', error);
    return { success: false, error: 'Failed to update user' };
  }
}

export async function deleteUser(id: string): Promise<ActionResponse<boolean>> {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return { success: false, error: 'Forbidden' };
    if (!session.userId) return { success: false, error: 'User ID manquant dans la session' };

    if (id === session.userId) {
      return { success: false, error: 'Impossible de supprimer votre propre compte' };
    }

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const tf = buildTenantFilter(activeTenantId);
    const targetUser = db.prepare(`SELECT id, name, username, email FROM users WHERE id = ?${tf.sql}`).get(id, ...tf.params) as { id: string; name?: string; username?: string; email?: string } | undefined;
    if (!targetUser) return { success: false, error: 'User not found' };

    db.prepare('UPDATE users SET is_active = 0, deletedAt = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    logAudit('DELETE', 'user', id, `Utilisateur désactivé/supprimé: ${targetUser?.name || targetUser?.username || targetUser?.email || id}`, session.userId, session.name || session.username || null, activeTenantId);

    return { success: true, data: true };
  } catch (error) {
    console.error('[Action deleteUser] Error:', error);
    return { success: false, error: 'Failed to delete user' };
  }
}
