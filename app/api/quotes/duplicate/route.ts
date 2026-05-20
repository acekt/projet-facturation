import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { quoteId } = await request.json();

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId) as any;
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const items = db.prepare('SELECT * FROM quote_items WHERE quoteId = ?').all(quoteId) as any[];

    const settings = db.prepare('SELECT quotePrefix FROM settings WHERE id = 1').get() as any;
    const year = new Date().getFullYear();
    const newId = crypto.randomUUID();

    const duplicate = db.transaction(() => {
      db.prepare("UPDATE sequences SET current_value = current_value + 1 WHERE name = 'quote'").run();
      const sequence = db.prepare("SELECT current_value FROM sequences WHERE name = 'quote'").get() as any;
      const number = `${settings.quotePrefix}-${year}-${String(sequence.current_value).padStart(4, '0')}`;

      db.prepare(`
        INSERT INTO quotes (
          id, number, clientId, clientName, clientEmail, date, dueDate,
          subtotal, discount, taxBase, tvaAmount, cssAmount, total, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newId,
        number,
        quote.clientId,
        quote.clientName,
        quote.clientEmail,
        new Date().toISOString().split('T')[0],
        quote.dueDate,
        quote.subtotal,
        quote.discount,
        quote.taxBase,
        quote.tvaAmount,
        quote.cssAmount,
        quote.total,
        quote.notes,
        'draft'
      );

      const insertItem = db.prepare(`
        INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(
          crypto.randomUUID(),
          newId,
          item.description,
          item.quantity,
          item.unitPrice,
          item.total
        );
      }

      return { id: newId, number };
    });

    const result = duplicate();
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Duplication failed' }, { status: 500 });
  }
}
