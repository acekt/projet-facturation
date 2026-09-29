import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { setupSchema } from '@/lib/validations';
import { signSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import { SetupService } from '@/lib/services/SetupService';
import type { SessionResponse, ErrorResponse } from '@/lib/types/api';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (SetupService.isInitialized()) {
      const errorResponse: ErrorResponse = {
        error: "L'application est déjà initialisée. Configuration interdite.",
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    const body: unknown = await request.json();
    const validation = setupSchema.safeParse(body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Données de configuration invalides',
        details: {
          fieldErrors: validation.error.flatten().fieldErrors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const data = validation.data;
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(data.password, 10);

    let setupResult;
    try {
      setupResult = SetupService.initializeApp(data, hashedPassword);
    } catch (txError: any) {
      if (txError.message === 'ALREADY_INITIALIZED') {
        const errorResponse: ErrorResponse = {
          error: "L'application est déjà initialisée. Configuration interdite.",
        };
        return NextResponse.json(errorResponse, { status: 403 });
      }
      throw txError;
    }

    const { userId, cleanName, cleanEmail } = setupResult;

    logAudit('CREATE', 'user', userId, JSON.stringify({ action: 'FIRST_RUN_SETUP', companyName: data.companyName, adminEmail: cleanEmail }), userId, cleanName);

    // Create session data exactly like login
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
        phone: data.phone || undefined,
        created_at: new Date().toISOString(),
      },
    };

    const response = NextResponse.json(sessionPayload, { status: 201 });
    response.cookies.set('auth_session', signedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    try {
      (await cookies()).set('auth_session', signedSession, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24,
        path: '/',
      });
    } catch (e) {
      // Ignore outside request scope
    }

    return response;
  } catch (error) {
    console.error('[Setup API] Error:', error);
    const errorResponse: ErrorResponse = {
      error: "Erreur lors de l'initialisation du serveur",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
