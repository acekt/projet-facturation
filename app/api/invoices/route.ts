import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { invoiceSchema } from '@/lib/validations';
import crypto from 'crypto';

export async function GET() {
  try {
    const invoices = db.prepare(`
      SELECT i.*,
             (SELECT json_group_array(json_object(
               'id', id,
               'description', description,
               'quantity', quantity,
               'unitPrice', unitPrice,
               'total', total
             )) FROM invoice_items WHERE invoiceId = i.id) as items
      FROM invoices i
      ORDER BY createdAt DESC
    `).all();

    const formattedInvoices = invoices.map((i: any) => ({
      ...i,
      items: JSON.parse(i.items)
    }));

    return NextResponse.json(formattedInvoices);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = invoiceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const data = validation.data;
    const settings = db.prepare('SELECT invoicePrefix FROM settings WHERE id = 1').get() as any;
    const year = new Date().getFullYear();
    const id = crypto.randomUUID();

    const insertInvoice = db.transaction((invData) => {
      db.prepare("UPDATE sequences SET current_value = current_value + 1 WHERE name = 'invoice'").run();
      const sequence = db.prepare("SELECT current_value FROM sequences WHERE name = 'invoice'").get() as any;
      const number = `${settings.invoicePrefix}-${year}-${String(sequence.current_value).padStart(4, '0')}`;

      db.prepare(`
        INSERT INTO invoices (
          id, number, quoteId, clientId, clientName, clientEmail, date, dueDate,
          subtotal, discount, taxBase, tvaAmount, cssAmount, total, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, number, invData.quoteId || null, invData.clientId, invData.clientName, invData.clientEmail, invData.date, invData.dueDate,
        Math.round(invData.subtotal), Math.round(invData.discount), Math.round(invData.taxBase),
        Math.round(invData.tvaAmount), Math.round(invData.cssAmount), Math.round(invData.total), invData.notes,
        invData.status === 'pending' ? 'UNPAID' : invData.status
      );

      const insertItem = db.prepare(`
        INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of invData.items) {
        insertItem.run(
          crypto.randomUUID(),
          id,
          item.description,
          item.quantity,
          Math.round(item.unitPrice),
          Math.round(item.total)
        );
      }

      if (invData.quoteId) {
        db.prepare("UPDATE quotes SET status = 'invoiced' WHERE id = ?").run(invData.quoteId);
      }

      return { id, number };
    });

    const result = insertInvoice(data);
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
