import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/api/auth';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const user = db.prepare('SELECT id, name, role, username FROM users WHERE id = ?').get(session.id) as any;
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ user: { id: user.id, name: user.name, role: user.role } });
    } catch (error) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
