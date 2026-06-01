import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import { settingsSchema } from '@/lib/validations';

export async function GET() {
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    // RBAC Check
    const session = await getSession();
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session?.userId) as any;
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const body = await request.json();

    // Validation
    const validation = settingsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const data = validation.data;
    const fields = Object.keys(data);
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = Object.values(data);

    db.prepare(`UPDATE settings SET ${setClause} WHERE id = 1`).run(...values);

    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
