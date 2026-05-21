import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get invoiceId before deleting to update status later
    const payment = db.prepare('SELECT invoiceId FROM payments WHERE id = ?').get(id) as any;
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const deleteResult = db.transaction(() => {
      db.prepare('DELETE FROM payments WHERE id = ?').run(id);

      const invoice = db.prepare('SELECT total FROM invoices WHERE id = ?').get(payment.invoiceId) as any;
      const { totalPaid } = db.prepare('SELECT SUM(amount) as totalPaid FROM payments WHERE invoiceId = ?')
        .get(payment.invoiceId) as any;

      const actualPaid = totalPaid || 0;
      let newStatus = 'UNPAID';
      if (actualPaid >= invoice.total) newStatus = 'PAID';
      else if (actualPaid > 0) newStatus = 'PARTIALLY_PAID';

      db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(newStatus, payment.invoiceId);
      return true;
    })();

    return NextResponse.json({ success: deleteResult });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
