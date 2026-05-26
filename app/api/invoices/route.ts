import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { invoiceSchema } from '@/lib/validations';
import crypto from 'crypto';
import { logAudit } from '@/lib/api/audit';

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
             )) FROM invoice_items WHERE invoiceId = i.id) as items,
             (SELECT json_group_array(json_object(
               'id', id,
               'amount', amount,
               'paymentMethod', paymentMethod,
               'date', date
             )) FROM payments WHERE invoiceId = i.id) as payments
      FROM invoices i
      WHERE i.deletedAt IS NULL
      ORDER BY createdAt DESC
    `).all();

    const formattedInvoices = invoices.map((i: any) => ({
      ...i,
      items: JSON.parse(i.items),
      payments: JSON.parse(i.payments)
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

    // RULE 1: quoteId is strictly mandatory to create an invoice
    if (!data.quoteId) {
      return NextResponse.json({ error: 'Une facture doit être associée à un devis existant.' }, { status: 400 });
    }

    // Validate the quote exists, is not soft-deleted, and has not been converted yet
    const quote = db.prepare('SELECT status, deletedAt FROM quotes WHERE id = ?').get(data.quoteId) as any;
    if (!quote) {
      return NextResponse.json({ error: 'Devis introuvable.' }, { status: 400 });
    }
    if (quote.deletedAt !== null) {
      return NextResponse.json({ error: 'Le devis associé a été supprimé.' }, { status: 400 });
    }
    if (quote.status === 'invoiced') {
      return NextResponse.json({ error: 'Ce devis a déjà été converti en facture.' }, { status: 400 });
    }

    const settings = db.prepare('SELECT invoicePrefix, companyCode FROM settings WHERE id = 1').get() as any;
    const year = new Date().getFullYear();
    const id = crypto.randomUUID();

    const insertInvoice = db.transaction((invData) => {
      db.prepare("UPDATE sequences SET current_value = current_value + 1 WHERE name = 'invoice'").run();
      const sequence = db.prepare("SELECT current_value FROM sequences WHERE name = 'invoice'").get() as any;
      const number = `${String(sequence.current_value).padStart(3, '0')}/${settings.companyCode}/${year}`;

      db.prepare(`
        INSERT INTO invoices (
          id, number, quoteId, clientId, clientName, clientEmail, date, dueDate,
          subtotal, discount, taxBase, tvaAmount, cssAmount, total, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, number, invData.quoteId, invData.clientId, invData.clientName, invData.clientEmail, invData.date, invData.dueDate,
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

      // Automatically update the quote status to 'invoiced'
      db.prepare("UPDATE quotes SET status = 'invoiced' WHERE id = ?").run(invData.quoteId);

      logAudit('CREATE', 'invoice', id, `Nouvelle facture créée: ${number}`);
      return { id, number };
    });

    const result = insertInvoice(data);
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
