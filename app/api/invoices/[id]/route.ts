import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    db.transaction(() => {
      db.prepare('DELETE FROM invoice_items WHERE invoiceId = ?').run(id);
      db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
    })();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}
