import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export async function GET() {
    try {
        // RBAC Check
        const sessionId = (await cookies()).get('auth_session')?.value;
        const user = db.prepare('SELECT role FROM users WHERE id = ?').get(sessionId) as any;
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const logs = db.prepare('SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT 100').all();
        return NextResponse.json(logs);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}
