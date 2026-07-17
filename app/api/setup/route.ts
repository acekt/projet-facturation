import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { setupSchema } from '@/lib/validations';
import { signSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import type { SessionResponse, ErrorResponse } from '@/lib/types/api';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const countResult = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number } | undefined;
    const count = countResult?.c || 0;
    if (count > 0) {
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

    const {
      name,
      email,
      password,
      phone,
      companyName,
      nif,
      rccm,
      address,
      companyPhone,
      companyEmail,
    } = validation.data;

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();

    const setupTransaction = db.transaction(() => {
      // Double check inside transaction for strict concurrency safety
      const innerCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number })?.c || 0;
      if (innerCount > 0) {
        throw new Error('ALREADY_INITIALIZED');
      }

      // Insert Admin User with hashed password and normalized email/username
      db.prepare(`
        INSERT INTO users (id, username, email, password, name, role, is_active, phone)
        VALUES (?, ?, ?, ?, ?, 'admin', 1, ?)
      `).run(userId, cleanEmail, cleanEmail, hashedPassword, cleanName, phone || null);

      // Insert or Update Company Settings
      const settingsCount = (db.prepare('SELECT COUNT(*) as c FROM settings WHERE id = 1').get() as { c: number })?.c || 0;
      if (settingsCount === 0) {
        db.prepare(`
          INSERT INTO settings (id, companyName, nif, rccm, address, phone, email, tvaRate, tpsRate, cssRate, invoicePrefix, quotePrefix, companyCode)
          VALUES (1, ?, ?, ?, ?, ?, ?, 18.0, 9.5, 1.0, 'FAC-', 'DEV-', 'ETOILE')
        `).run(
          companyName || '',
          nif || '',
          rccm || '',
          address || '',
          companyPhone || '',
          companyEmail || ''
        );
      } else {
        db.prepare(`
          UPDATE settings
          SET companyName = ?, nif = ?, rccm = ?, address = ?, phone = ?, email = ?
          WHERE id = 1
        `).run(
          companyName || '',
          nif || '',
          rccm || '',
          address || '',
          companyPhone || '',
          companyEmail || ''
        );
      }
    });

    try {
      setupTransaction();
    } catch (txError: any) {
      if (txError.message === 'ALREADY_INITIALIZED') {
        const errorResponse: ErrorResponse = {
          error: "L'application est déjà initialisée. Configuration interdite.",
        };
        return NextResponse.json(errorResponse, { status: 403 });
      }
      throw txError;
    }

    logAudit('CREATE', 'user', userId, JSON.stringify({ action: 'FIRST_RUN_SETUP', companyName, adminEmail: cleanEmail }), userId, cleanName);

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
        phone: phone || undefined,
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
