import { NextResponse } from 'next/server';
import db from '@/lib/db';

function updateInvoiceStatus(invoiceId: string) {
    const invoice = db.prepare('SELECT total FROM invoices WHERE id = ?').get(invoiceId) as any;
    const payments = db.prepare('SELECT SUM(amount) as totalPaid FROM payments WHERE invoiceId = ?').get(invoiceId) as any;

    const totalTTC = Math.round(invoice.total);
    const totalPaid = Math.round(payments.totalPaid || 0);

    let newStatus = 'UNPAID';
    if (totalPaid === 0) {
        newStatus = 'UNPAID';
    } else if (totalPaid < totalTTC) {
        newStatus = 'PARTIALLY_PAID';
    } else {
        newStatus = 'PAID';
    }

    db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(newStatus, invoiceId);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    const payment = db.prepare('SELECT invoiceId FROM payments WHERE id = ?').get(id) as any;
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

    const invoiceId = payment.invoiceId;

    db.transaction(() => {
        db.prepare('DELETE FROM payments WHERE id = ?').run(id);
        updateInvoiceStatus(invoiceId);
    })();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
