"use server";

import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { setupSchema } from '@/lib/validations';
import { signSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import { SetupService } from '@/lib/services/SetupService';
import { EnrollmentService, type IEnrollmentInput } from '@/lib/services/EnrollmentService';
import { provisionCloudAccount } from '@/lib/sync/CloudSyncService';
import type { SessionResponse } from '@/lib/types/api';
import type { ActionResponse } from './client.actions';

export async function setupApp(data: any): Promise<ActionResponse<SessionResponse>> {
  try {
    const validation = setupSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données de configuration invalides', details: validation.error.flatten().fieldErrors };
    }

    const validData = validation.data;
    const hashedPassword = await bcrypt.hash(validData.password, 10);

    const setupResult = SetupService.initializeApp(validData, hashedPassword);

    const { userId, tenantId, cleanName, cleanEmail } = setupResult;

    logAudit('CREATE', 'user', userId, JSON.stringify({ action: 'FIRST_RUN_SETUP', companyName: validData.companyName, adminEmail: cleanEmail }), userId, cleanName, tenantId);

    // Provisioning Cloud (Auth + tenant + profil admin). Non bloquant : repris à la 1ère sync si hors-ligne.
    const cloud = await provisionCloudAccount({
      email: cleanEmail,
      password: validData.password,
      name: cleanName,
      phone: validData.phone || null,
      companyName: validData.companyName,
      localTenantId: tenantId,
    });
    console.log(`[Setup] Provisioning Cloud : ${cloud.status}`);
    const effectiveTenantId = cloud.tenantId || tenantId;

    const sessionData = JSON.stringify({
      userId: userId,
      name: cleanName,
      role: 'admin',
      tenantId: effectiveTenantId,
      exp: Date.now() + (24 * 60 * 60 * 1000),
    });

    const base64Data = Buffer.from(sessionData).toString('base64');
    const signedSession = await signSession(base64Data);

    const sessionPayload: SessionResponse = {
      success: true,
      user: {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        username: cleanEmail,
        role: 'admin',
        is_active: 1,
        phone: validData.phone || undefined,
        created_at: new Date().toISOString(),
        tenant_id: effectiveTenantId,
      },
    };

    (await cookies()).set('auth_session', signedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return { success: true, data: sessionPayload };
  } catch (error) {
    console.error('[Action setupApp] Error:', error);
    return { success: false, error: "Erreur lors de l'initialisation du serveur" };
  }
}

/**
 * Enrôle un poste client Desktop au sein d'une organisation SaaS existante via identifiants Cloud.
 */
export async function enrollExistingTenant(input: IEnrollmentInput): Promise<ActionResponse<SessionResponse>> {
  try {
    const result = await EnrollmentService.enrollWithCloudTenant(input);

    const sessionData = JSON.stringify({
      userId: result.userId,
      name: result.cleanName,
      role: result.role,
      tenantId: result.tenantId,
      exp: Date.now() + (24 * 60 * 60 * 1000),
    });

    const base64Data = Buffer.from(sessionData).toString('base64');
    const signedSession = await signSession(base64Data);

    const sessionPayload: SessionResponse = {
      success: true,
      user: {
        id: result.userId,
        name: result.cleanName,
        email: result.cleanEmail,
        username: result.cleanEmail,
        role: result.role,
        is_active: 1,
        phone: result.phone || undefined,
        created_at: new Date().toISOString(),
        tenant_id: result.tenantId,
      },
    };

    (await cookies()).set('auth_session', signedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    logAudit(
      'LOGIN',
      'user',
      result.userId,
      JSON.stringify({ action: 'DEVICE_ENROLLED', companyName: result.companyName }),
      result.userId,
      result.cleanName,
      result.tenantId
    );

    return { success: true, data: sessionPayload };
  } catch (error: any) {
    console.error('[Action enrollExistingTenant] Error:', error);
    return {
      success: false,
      error: error?.message || "Impossible d'enrôler ce poste dans l'organisation",
    };
  }
}
