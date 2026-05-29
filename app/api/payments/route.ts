import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';
import { getSession } from '@/lib/api/auth';

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
    return newStatus;
}

export async function GET() {
  try {
    const payments = db.prepare('SELECT * FROM payments ORDER BY createdAt DESC').all();
    return NextResponse.json(payments);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // RBAC Check
    const session = await getSession();
    if (!session || session.role !== 'user') {
      return NextResponse.json({ error: 'Unauthorized: Only Users can record payments' }, { status: 403 });
    }

    const body = await request.json();
    const { invoiceId, amount, paymentMethod, date, reference } = body;
    const id = crypto.randomUUID();

    const insertPayment = db.transaction(() => {
      db.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, invoiceId, Math.round(amount), paymentMethod, date, reference);

      const newStatus = updateInvoiceStatus(invoiceId);
      return { id, newStatus };
    });

    const result = insertPayment();
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}
