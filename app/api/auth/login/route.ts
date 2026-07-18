import { NextResponse } from 'next/server';
import { UserRepository } from '@/lib/repositories/UserRepository';
import db from '@/lib/db';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { loginSchema } from '@/lib/validations';
import type { LoginRequest, SessionResponse, ErrorResponse, DbUser, DbCount } from '@/lib/types/api';

/**
 * SECURITY: Both SESSION_SECRET and PASSWORD_SALT must be defined in environment variables.
 * A missing or weak secret causes an immediate crash to force proper configuration.
 */
function getRequiredEnv(varName: string, minLength: number = 16): string {
  const value = process.env[varName]
  if (!value || value.length < minLength) {
    throw new Error(
      `[SECURITY] Environment variable '${varName}' is missing or too short (minimum ${minLength} characters). ` +
      'Set it in your .env.local file.'
    )
  }
  return value
}

function hashPassword(password: string): string {
  const salt = getRequiredEnv('PASSWORD_SALT', 16);
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

async function signSession(data: string): Promise<string> {
  const secret = getRequiredEnv('SESSION_SECRET', 32);
  // Use SubtleCrypto for compatibility with middleware (Web Crypto API)
  const key = await crypto.webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.webcrypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data)
  );

  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${data}.${base64Signature}`;
}

export async function POST(request: Request) {
  try {
    try {
      getRequiredEnv('PASSWORD_SALT', 16);
      getRequiredEnv('SESSION_SECRET', 32);
    } catch (configError: any) {
      const errorResponse: ErrorResponse = {
        error: "Configuration serveur invalide. Contactez l'administrateur.",
      };
      return NextResponse.json(errorResponse, { status: 503 });
    }

    const body: unknown = await request.json();

    // Validate request payload with Zod
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Données de connexion invalides',
        details: {
          fieldErrors: validation.error.flatten().fieldErrors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { username, password }: LoginRequest = validation.data;
    const cleanUsername = username.toLowerCase().trim();

    // Authenticate user by username or email case-insensitively, explicitly fetching password column
    const user = db.prepare(`
      SELECT id, name, email, username, password, role, is_active, force_password_change, created_at, last_login_at, phone
      FROM users
      WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND deletedAt IS NULL
    `).get(cleanUsername, cleanUsername) as DbUser | undefined;

    if (!user) {
      const errorResponse: ErrorResponse = {
        error: 'Identifiants invalides',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    // Verify password strictly with bcrypt first, then fallback to legacy SHA-256
    const bcrypt = require('bcryptjs');
    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } catch (e) {
      // If bcrypt fails (e.g. invalid salt format on legacy hash), it will throw or return false
      isPasswordValid = false;
    }

    if (!isPasswordValid && user.password) {
      // Legacy SHA-256 fallback
      const legacyHash = hashPassword(password);
      isPasswordValid = user.password === legacyHash;
    }

    if (!isPasswordValid) {
      const errorResponse: ErrorResponse = {
        error: 'Identifiants invalides',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    // Check if user account is active
    if (user.is_active === 0) {
      const errorResponse: ErrorResponse = {
        error: 'Compte inactif. Veuillez contacter votre administrateur.',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    try {
      UserRepository.updateLastLogin(user.id);
    } catch (e) {
      console.error('[Login] Failed to update last_login_at:', e);
    }

    // Create session data strictly using exact user.role from database without any fallback
    const sessionData = JSON.stringify({
      userId: user.id,
      name: user.name,
      role: user.role,
      exp: Date.now() + (24 * 60 * 60 * 1000)
    });

    const base64Data = Buffer.from(sessionData).toString('base64');
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
        created_at: user.created_at,
        last_login_at: user.last_login_at,
        phone: user.phone,
      },
    };

    const response = NextResponse.json(sessionPayload);
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
      // Ignore when called outside Next.js request scope (e.g., Vitest integration tests)
    }

    return response;
  } catch (error) {
    console.error('[Login] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Erreur serveur',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
