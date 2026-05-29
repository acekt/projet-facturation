import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND deletedAt IS NULL').get(id);
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const items = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(id);
    const payments = db.prepare('SELECT * FROM payments WHERE invoiceId = ?').all(id);

    return NextResponse.json({ ...invoice, items, payments });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}

// RULE 2: Invoices are strictly immutable once generated. Block any updates.
export async function PUT() {
  return NextResponse.json({ error: 'Une facture générée est strictement immuable et ne peut pas être modifiée.' }, { status: 405 });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    // RULE 5: Enforce Soft Delete to maintain fiscal audit trail
    const result = db.prepare("UPDATE invoices SET deletedAt = datetime('now'), status = 'cancelled' WHERE id = ?").run(id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}
