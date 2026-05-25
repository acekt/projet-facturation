import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export async function GET() {
    try {
        const sessionId = (await cookies()).get('auth_session')?.value;
        if (!sessionId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const user = db.prepare('SELECT id, name, role, username FROM users WHERE id = ?').get(sessionId) as any;
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ user: { id: user.id, name: user.name, role: user.role } });
    } catch (error) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
