import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { quoteSchema } from '@/lib/validations';
import crypto from 'crypto';
import { logAudit } from '@/lib/api/audit';
import { getNextNumber } from '@/lib/api/numbering';

export async function GET() {
  try {
    const quotes = db.prepare(`
      SELECT q.*,
             (SELECT json_group_array(json_object(
               'id', id,
               'description', description,
               'quantity', quantity,
               'unitPrice', unitPrice,
               'total', total
             )) FROM quote_items WHERE quoteId = q.id) as items
      FROM quotes q
      WHERE q.deletedAt IS NULL
      ORDER BY createdAt DESC
    `).all();

    const formattedQuotes = quotes.map((q: any) => ({
      ...q,
      items: JSON.parse(q.items)
    }));

    return NextResponse.json(formattedQuotes);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // RBAC Check
    const sessionId = (await cookies()).get('auth_session')?.value;
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(sessionId) as any;
    if (!user || user.role !== 'user') {
      return NextResponse.json({ error: 'Unauthorized: Only Users can create quotes' }, { status: 403 });
    }

    const body = await request.json();

    const validation = quoteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const data = validation.data;
    const id = crypto.randomUUID();

    const insertQuote = db.transaction((quoteData) => {
      const number = getNextNumber('quote');

      db.prepare(`
        INSERT INTO quotes (
          id, number, clientId, clientName, clientEmail, date, dueDate,
          subtotal, discount, taxBase, tvaAmount, cssAmount, total, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, number, quoteData.clientId, quoteData.clientName, quoteData.clientEmail, quoteData.date, quoteData.dueDate,
        Math.round(quoteData.subtotal), Math.round(quoteData.discount), Math.round(quoteData.taxBase),
        Math.round(quoteData.tvaAmount), Math.round(quoteData.cssAmount), Math.round(quoteData.total),
        quoteData.notes, quoteData.status
      );

      const insertItem = db.prepare(`
        INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of quoteData.items) {
        insertItem.run(
          crypto.randomUUID(),
          id,
          item.description,
          item.quantity,
          Math.round(item.unitPrice),
          Math.round(item.total)
        );
      }

      logAudit('CREATE', 'quote', id, `Nouveau devis créé: ${number}`);
      return { id, number };
    });

    const result = insertQuote(data);
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 });
  }
}
