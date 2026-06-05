import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { loginSchema } from '@/lib/validations';
import type { LoginRequest, SessionResponse, ErrorResponse, DbUser, DbCount } from '@/lib/types/api';

const SALT = process.env.PASSWORD_SALT || 'letoile-gabon-2026';
const SESSION_SECRET = process.env.SESSION_SECRET || 'letoile-secret-key-2026-signing';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

async function signSession(data: string): Promise<string> {
  // Use SubtleCrypto for compatibility with middleware (Web Crypto API)
  const key = await crypto.webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SESSION_SECRET),
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
    const hashedPassword = hashPassword(password);

    // Check if users table is empty (first-time setup)
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as DbCount;
    if (userCount.count === 0) {
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)')
        .run(id, username, hashedPassword, 'Administrateur', 'admin');
    }

    // Authenticate user
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, hashedPassword) as DbUser | undefined;

    if (!user) {
      const errorResponse: ErrorResponse = {
        error: 'Identifiants invalides',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    // Create session data
    const sessionData = JSON.stringify({
      userId: user.id,
      name: user.name,
      role: user.role,
      exp: Date.now() + (24 * 60 * 60 * 1000)
    });

    const base64Data = Buffer.from(sessionData).toString('base64');
    const signedSession = await signSession(base64Data);

    (await cookies()).set('auth_session', signedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    const response: SessionResponse = {
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

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Login] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Erreur serveur',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
