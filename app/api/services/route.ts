import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import { serviceSchema } from '@/lib/validations';
import crypto from 'crypto';

export async function GET() {
  try {
    const services = db.prepare('SELECT * FROM services ORDER BY name ASC').all();
    return NextResponse.json(services);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // RBAC Check
    const session = await getSession();
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session?.userId) as any;
    if (!user || user.role !== 'user') {
      return NextResponse.json({ error: 'Unauthorized: Only Users can manage services' }, { status: 403 });
    }

    const body = await request.json();

    // Validation
    const validation = serviceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const { name, description, category, unitPrice } = validation.data;
    const id = crypto.randomUUID();

    db.prepare('INSERT INTO services (id, name, description, category, unitPrice) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, description, category, Math.round(unitPrice));

    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    return NextResponse.json(service);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}
