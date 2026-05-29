import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';
import { getSession } from '@/lib/api/auth';

const SALT = 'letoile-gabon-2026';
function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (session.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const users = db.prepare('SELECT id, name, email, role, is_active, created_at, last_login_at FROM users').all();
        return NextResponse.json(users);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (session.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { name, email, role, password } = await request.json();

        if (!name || !email || !role || !password) {
            return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
        }

        const id = crypto.randomUUID();
        const hashedPassword = hashPassword(password);

        db.prepare(`
            INSERT INTO users (id, name, email, username, password, role, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        `).run(id, name, email, email, hashedPassword, role, session.id);

        return NextResponse.json({ id, name, email, role });
    } catch (error: any) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}
