import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { clientSchema } from '@/lib/validations';
import { crypto } from 'crypto';

export async function GET() {
  try {
    const clients = db.prepare('SELECT * FROM clients ORDER BY name ASC').all();
    return NextResponse.json(clients);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validation
    const validation = clientSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const { name, email, phone, address } = validation.data;
    const id = crypto.randomUUID();

    db.prepare('INSERT INTO clients (id, name, email, phone, address) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, email, phone, address);

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    return NextResponse.json(client);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}
