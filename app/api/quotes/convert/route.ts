import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import crypto from 'crypto';
import { getNextNumber } from '@/lib/api/numbering';

export async function POST(request: Request) {
  try {
    // RBAC Check
    const session = await getSession();
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session?.userId) as any;
    if (!user || user.role !== 'user') {
      return NextResponse.json({ error: 'Unauthorized: Only Users can convert quotes' }, { status: 403 });
    }

    const { quoteId } = await request.json();

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId) as any;
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.deletedAt !== null) {
      return NextResponse.json({ error: 'Cannot convert a deleted quote' }, { status: 400 });
    }

    if (quote.status === 'invoiced') {
      return NextResponse.json({ error: 'Quote already invoiced' }, { status: 400 });
    }

    const items = db.prepare('SELECT * FROM quote_items WHERE quoteId = ?').all(quoteId) as any[];

    const settings = db.prepare('SELECT invoicePrefix, companyCode FROM settings WHERE id = 1').get() as any;
    const invoiceId = crypto.randomUUID();

    const convert = db.transaction(() => {
      const number = getNextNumber('invoice');

      // Create invoice
      db.prepare(`
        INSERT INTO invoices (
          id, number, quoteId, clientId, clientName, clientEmail, date, dueDate,
          subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId,
        number,
        quoteId,
        quote.clientId,
        quote.clientName,
        quote.clientEmail,
        new Date().toISOString().split('T')[0],
        new Date().toISOString().split('T')[0],
        Math.round(quote.subtotal),
        Math.round(quote.discount),
        Math.round(quote.taxBase),
        Math.round(quote.tvaAmount),
        Math.round(quote.tpsAmount || 0),
        Math.round(quote.cssAmount),
        Math.round(quote.total),
        'UNPAID',
        quote.notes
      );

      // Copy items
      const insertItem = db.prepare(`
        INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(
          crypto.randomUUID(),
          invoiceId,
          item.description,
          item.quantity,
          Math.round(item.unitPrice),
          Math.round(item.total)
        );
      }

      // Update quote status
      db.prepare("UPDATE quotes SET status = 'invoiced' WHERE id = ?").run(quoteId);

      return { id: invoiceId, number };
    });

    const result = convert();
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Conversion failed' }, { status: 500 });
  }
}
