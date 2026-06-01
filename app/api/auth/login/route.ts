import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const SALT = 'letoile-gabon-2026';
const SESSION_SECRET = 'letoile-secret-key-2026-signing';

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

async function signSession(data: string) {
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
    const { username, password } = await request.json();
    const hashedPassword = hashPassword(password);

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (userCount.count === 0) {
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)')
        .run(id, username, hashedPassword, 'Administrateur', 'admin');
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, hashedPassword) as any;

    if (!user) {
      return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 });
    }

    // Session Data
    const sessionData = JSON.stringify({
      userId: user.id,
      name: user.name,
      role: user.role,
      exp: Date.now() + (24 * 60 * 60 * 1000)
    });

    const base64Data = btoa(sessionData);
    const signedSession = await signSession(base64Data);

    (await cookies()).set('auth_session', signedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return NextResponse.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
