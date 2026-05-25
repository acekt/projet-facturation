import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { clientSchema } from '@/lib/validations';
import { logAudit } from '@/lib/api/audit';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    return NextResponse.json(client);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validation = clientSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const { name, email, phone, address } = validation.data;

    const result = db.prepare('UPDATE clients SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?')
      .run(name, email, phone, address, id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    logAudit('UPDATE', 'client', id, `Client mis à jour: ${name}`);
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    return NextResponse.json(client);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const client = db.prepare('SELECT name FROM clients WHERE id = ?').get(id) as any;
    const result = db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    logAudit('DELETE', 'client', id, `Client supprimé: ${client?.name || id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
