import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { cookies } from 'next/headers';
import crypto from 'crypto';

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const hashedPassword = hashPassword(password);

    // In a real local desktop app, we might have a single admin user
    // For this implementation, we check the 'users' table.
    // If empty, the first login creates the admin.

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

    if (userCount.count === 0) {
      // Create default admin on first attempt for local simplicity
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)')
        .run(id, username, hashedPassword, 'Administrateur', 'admin');
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, hashedPassword) as any;

    if (!user) {
      return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 });
    }

    // Set a simple cookie for local session
    (await cookies()).set('auth_session', user.id, {
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
