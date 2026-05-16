import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { serviceSchema } from '@/lib/validations';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validation
    const validation = serviceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const { name, description, category, unitPrice } = validation.data;

    db.prepare('UPDATE services SET name = ?, description = ?, category = ?, unitPrice = ? WHERE id = ?')
      .run(name, description, category, unitPrice, id);

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
    db.prepare('DELETE FROM services WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 });
  }
}
