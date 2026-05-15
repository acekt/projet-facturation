import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PATCH(request: Request) {
  try {
    const { invoiceId, status } = await request.json();

    if (!['paid', 'pending', 'overdue', 'draft', 'cancelled'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    db.prepare("UPDATE invoices SET status = ? WHERE id = ?").run(status, invoiceId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
