"use server";

import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { setupSchema } from '@/lib/validations';
import { signSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import { SetupService } from '@/lib/services/SetupService';
import type { SessionResponse } from '@/lib/types/api';
import type { ActionResponse } from './client.actions';

export async function setupApp(data: any): Promise<ActionResponse<SessionResponse>> {
  try {
    if (SetupService.isInitialized()) {
      return { success: false, error: "L'application est déjà initialisée. Configuration interdite." };
    }

    const validation = setupSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données de configuration invalides', details: validation.error.flatten().fieldErrors };
    }

    const validData = validation.data;
    const hashedPassword = await bcrypt.hash(validData.password, 10);

    let setupResult;
    try {
      setupResult = SetupService.initializeApp(validData, hashedPassword);
    } catch (txError: any) {
      if (txError.message === 'ALREADY_INITIALIZED') {
        return { success: false, error: "L'application est déjà initialisée. Configuration interdite." };
      }
      throw txError;
    }

    const { userId, cleanName, cleanEmail } = setupResult;

    logAudit('CREATE', 'user', userId, JSON.stringify({ action: 'FIRST_RUN_SETUP', companyName: validData.companyName, adminEmail: cleanEmail }), userId, cleanName);

    const sessionData = JSON.stringify({
      userId: userId,
      name: cleanName,
      role: 'admin',
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
