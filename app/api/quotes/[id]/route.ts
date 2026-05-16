import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { quoteSchema } from '@/lib/validations';
import { crypto } from 'crypto';

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
    const body = await request.json();

    // Validation
    const validation = quoteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const data = validation.data;
    const settings = db.prepare('SELECT quotePrefix FROM settings WHERE id = 1').get() as any;
    const year = new Date().getFullYear();
    const id = crypto.randomUUID();

    const insertQuote = db.transaction((quoteData) => {
      // Get and increment sequence
      db.prepare("UPDATE sequences SET current_value = current_value + 1 WHERE name = 'quote'").run();
      const sequence = db.prepare("SELECT current_value FROM sequences WHERE name = 'quote'").get() as any;
      const number = `${settings.quotePrefix}-${year}-${String(sequence.current_value).padStart(4, '0')}`;

      // Currency Rounding to nearest integer for XAF
      const roundedSubtotal = Math.round(quoteData.subtotal);
      const roundedDiscount = Math.round(quoteData.discount);
      const roundedTaxBase = Math.round(quoteData.taxBase);
      const roundedTva = Math.round(quoteData.tvaAmount);
      const roundedCss = Math.round(quoteData.cssAmount);
      const roundedTotal = Math.round(quoteData.total);

      db.prepare(`
        INSERT INTO quotes (
          id, number, clientId, clientName, clientEmail, date, dueDate,
          subtotal, discount, taxBase, tvaAmount, cssAmount, total, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, number, quoteData.clientId, quoteData.clientName, quoteData.clientEmail, quoteData.date, quoteData.dueDate,
        roundedSubtotal, roundedDiscount, roundedTaxBase, roundedTva, roundedCss, roundedTotal, quoteData.notes, quoteData.status
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

      return { id, number };
    });

    const result = insertQuote(data);
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 });
  }
}
