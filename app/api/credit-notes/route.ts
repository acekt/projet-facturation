import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import crypto from 'crypto';

export async function GET() {
  try {
    const notes = db.prepare(`
      SELECT cn.*,
             (SELECT json_group_array(json_object(
               'id', id,
               'description', description,
               'quantity', quantity,
               'unitPrice', unitPrice,
               'total', total
             )) FROM credit_note_items WHERE creditNoteId = cn.id) as items
      FROM credit_notes cn
      ORDER BY createdAt DESC
    `).all();

    const formatted = notes.map((n: any) => ({
      ...n,
      items: JSON.parse(n.items)
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch credit notes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // RBAC Check
    const session = await getSession();
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session?.userId) as any;
    if (!user || user.role !== 'user') {
      return NextResponse.json({ error: 'Unauthorized: Only Users can create credit notes' }, { status: 403 });
    }

    const data = await request.json();
    const { invoiceId, reason, items } = data;

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const year = new Date().getFullYear();
    const id = crypto.randomUUID();

    // Sequence for credit notes? Let's add it if not exists or use a simple one
    db.exec("INSERT OR IGNORE INTO sequences (name, current_value) VALUES ('credit_note', 0)");

    const settings = db.prepare('SELECT companyCode FROM settings WHERE id = 1').get() as any;

    const insertCreditNote = db.transaction((cnData) => {
      db.prepare("UPDATE sequences SET current_value = current_value + 1 WHERE name = 'credit_note'").run();
      const sequence = db.prepare("SELECT current_value FROM sequences WHERE name = 'credit_note'").get() as any;
      const number = `${String(sequence.current_value).padStart(3, '0')}/${settings.companyCode}/${year}`;

      // Calculate totals based on items
      const subtotal = Math.round(items.reduce((acc: number, item: any) => acc + (item.quantity * item.unitPrice), 0));
      const rates = db.prepare('SELECT tvaRate, cssRate FROM settings WHERE id = 1').get() as any;

      const cssAmount = Math.round(subtotal * (rates.cssRate / 100));
      const taxBase = subtotal + cssAmount;
      const tvaAmount = Math.round(taxBase * (rates.tvaRate / 100));
      const total = subtotal + cssAmount + tvaAmount;

      db.prepare(`
        INSERT INTO credit_notes (
          id, number, invoiceId, clientId, clientName, date, reason,
          subtotal, taxBase, tvaAmount, cssAmount, total, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, number, invoice.id, invoice.clientId, invoice.clientName,
        new Date().toISOString().split('T')[0], reason,
        subtotal, taxBase, tvaAmount, cssAmount, total, 'open'
      );

      const insertItem = db.prepare(`
        INSERT INTO credit_note_items (id, creditNoteId, description, quantity, unitPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(
          crypto.randomUUID(),
          id,
          item.description,
          item.quantity,
          item.unitPrice,
          item.quantity * item.unitPrice
        );
      }

      // Update invoice status to 'cancelled' or similar if needed
      db.prepare("UPDATE invoices SET status = 'cancelled' WHERE id = ?").run(invoice.id);

      return { id, number };
    });

    const result = insertCreditNote({ invoiceId, reason, items });
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create credit note' }, { status: 500 });
  }
}
