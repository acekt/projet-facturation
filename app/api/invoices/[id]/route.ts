import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const items = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(id);
    const payments = db.prepare('SELECT * FROM payments WHERE invoiceId = ?').all(id);

    return NextResponse.json({ ...invoice, items, payments });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    // We might want to allow deletion even if paid, but usually caution is better.
    // For now, let's allow it as requested by the user audit.
    const result = db.prepare('DELETE FROM invoices WHERE id = ?').run(id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}
