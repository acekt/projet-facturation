import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import type { DbUser } from '@/lib/types/api';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const user = db.prepare('SELECT id, name, email, username, role, is_active, created_at, last_login_at, phone FROM users WHERE id = ?').get(session.userId) as DbUser | undefined;

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (user.is_active === 0) {
            return NextResponse.json({ error: 'Compte désactivé' }, { status: 403 });
        }

        return NextResponse.json({ user });
    } catch (error) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
