import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        const logs = db.prepare('SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT 100').all();
        return NextResponse.json(logs);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}
