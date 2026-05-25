import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { logAudit } from '@/lib/api/audit';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const { name, description, category, unitPrice } = await request.json();

    db.prepare('UPDATE services SET name = ?, description = ?, category = ?, unitPrice = ? WHERE id = ?')
      .run(name, description, category, Math.round(unitPrice), id);

    logAudit('UPDATE', 'service', id, `Service mis à jour: ${name}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const service = db.prepare('SELECT name FROM services WHERE id = ?').get(id) as any;
    db.prepare('DELETE FROM services WHERE id = ?').run(id);
    logAudit('DELETE', 'service', id, `Service supprimé: ${service?.name || id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 });
  }
}
