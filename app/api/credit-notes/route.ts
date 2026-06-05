import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import crypto from 'crypto';
import { creditNoteCreateSchema } from '@/lib/validations';
import type { CreditNoteCreateRequest, CreditNoteResponse, CreditNoteItem, ErrorResponse, DbCreditNote, DbCreditNoteItem, DbInvoice, DbSettings, DbSequence } from '@/lib/types/api';

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
      WHERE cn.deletedAt IS NULL
      ORDER BY createdAt DESC
    `).all() as (DbCreditNote & { items: string })[];

    const formatted: CreditNoteResponse[] = notes.map((n): CreditNoteResponse => ({
      ...n,
      items: JSON.parse(n.items || '[]') as CreditNoteItem[],
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('[API Credit Notes GET] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch credit notes',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // RBAC Check
    const session = await getSession();
    if (!session) {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Authentication required',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId) as { role: string } | undefined;
    if (!user || user.role !== 'user') {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Only Users can create credit notes',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    const body: unknown = await request.json();

    // Validate request payload with Zod
    const validation = creditNoteCreateSchema.safeParse(body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Données invalides',
        details: {
          fieldErrors: validation.error.flatten().fieldErrors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { invoiceId, reason, items }: CreditNoteCreateRequest = validation.data;

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND deletedAt IS NULL').get(invoiceId) as DbInvoice | undefined;
    if (!invoice) {
      const errorResponse: ErrorResponse = {
        error: 'Invoice not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const year = new Date().getFullYear();
    const id = crypto.randomUUID();

    // Sequence for credit notes
    db.exec("INSERT OR IGNORE INTO sequences (name, current_value) VALUES ('credit_note', 0)");

    const settings = db.prepare('SELECT companyCode FROM settings WHERE id = 1').get() as DbSettings | undefined;
    if (!settings) {
      const errorResponse: ErrorResponse = {
        error: 'Settings not found',
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    const insertCreditNote = db.transaction((cnData) => {
      db.prepare("UPDATE sequences SET current_value = current_value + 1 WHERE name = 'credit_note'").run();
      const sequence = db.prepare("SELECT current_value FROM sequences WHERE name = 'credit_note'").get() as DbSequence;
      const number = `${String(sequence.current_value).padStart(3, '0')}/${settings.companyCode}/${year}`;

      // Calculate totals based on items
      const subtotal = Math.round(items.reduce((acc: number, item) => acc + (item.quantity * item.unitPrice), 0));
      const rates = db.prepare('SELECT tvaRate, tpsRate, cssRate FROM settings WHERE id = 1').get() as { tvaRate: number; tpsRate?: number; cssRate: number } | undefined;
      if (!rates) {
        throw new Error('Tax rates not found');
      }

      const cssAmount = Math.round(subtotal * (rates.cssRate / 100));
      const taxBase = subtotal + cssAmount;
      const tpsAmount = Math.round(taxBase * ((rates.tpsRate || 0) / 100));
      const tvaAmount = Math.round(taxBase * (rates.tvaRate / 100));
      const total = subtotal + cssAmount + tpsAmount + tvaAmount;

      db.prepare(`
        INSERT INTO credit_notes (
          id, number, invoiceId, clientId, clientName, date, reason,
          subtotal, taxBase, tvaAmount, tpsAmount, cssAmount, total, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, number, invoice.id, invoice.clientId, invoice.clientName,
        new Date().toISOString().split('T')[0], reason,
        subtotal, taxBase, tvaAmount, tpsAmount, cssAmount, total, 'open'
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

      // Update invoice status to 'cancelled' if needed
      db.prepare("UPDATE invoices SET status = 'cancelled' WHERE id = ?").run(invoice.id);

      return { id, number };
    });

    const result = insertCreditNote({ invoiceId, reason, items });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Credit Notes POST] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to create credit note',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
