import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import crypto from 'crypto';
import { creditNoteCreateSchema } from '@/lib/validations';
import { getNextNumber } from '@/lib/api/numbering';
import type {
  CreditNoteCreateRequest,
  CreditNoteResponse,
  CreditNoteItem,
  ErrorResponse,
  DbCreditNote,
  DbInvoice,
  DbSettings,
} from '@/lib/types/api';

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
    const errorResponse: ErrorResponse = { error: 'Failed to fetch credit notes' };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // --- RBAC Check ---
    const session = await getSession();
    if (!session) {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Authentication required',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    const user = db
      .prepare('SELECT role FROM users WHERE id = ?')
      .get(session.userId) as { role: string } | undefined;
    if (!user || user.role !== 'user') {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Only Users can create credit notes',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    const body: unknown = await request.json();

    // --- Zod Validation ---
    const validation = creditNoteCreateSchema.safeParse(body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Données invalides',
        details: { fieldErrors: validation.error.flatten().fieldErrors },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { invoiceId, reason, items }: CreditNoteCreateRequest = validation.data;

    // --- Validate the linked invoice exists and is active ---
    const invoice = db
      .prepare('SELECT * FROM invoices WHERE id = ? AND deletedAt IS NULL')
      .get(invoiceId) as DbInvoice | undefined;
    if (!invoice) {
      const errorResponse: ErrorResponse = { error: 'Invoice not found' };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // --- Retrieve tax rates (server is source of truth) ---
    const settings = db
      .prepare('SELECT companyCode, tvaRate, tpsRate, cssRate FROM settings WHERE id = 1')
      .get() as (DbSettings & { tvaRate: number; tpsRate?: number; cssRate: number }) | undefined;
    if (!settings) {
      const errorResponse: ErrorResponse = { error: 'Settings not found' };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    // Ensure 'credit_note' sequence exists
    db.exec("INSERT OR IGNORE INTO sequences (name, current_value) VALUES ('credit_note', 0)");

    const id = crypto.randomUUID();

    const insertCreditNote = db.transaction(() => {
      const number = getNextNumber('credit_note');

      // --- Server-side total computation (same formula as invoice-logic.ts) ---
      const subtotal = Math.round(
        items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0)
      );
      const cssAmount = Math.round(subtotal * (settings.cssRate / 100));
      const taxBase = subtotal + cssAmount;
      const tpsAmount = Math.round(taxBase * ((settings.tpsRate ?? 0) / 100));
      const tvaAmount = Math.round(taxBase * (settings.tvaRate / 100));
      const creditNoteTotal = taxBase + tpsAmount + tvaAmount;

      db.prepare(`
        INSERT INTO credit_notes (
          id, number, invoiceId, clientId, clientName, date, reason,
          subtotal, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        number,
        invoice.id,
        invoice.clientId,
        invoice.clientName,
        new Date().toISOString().split('T')[0],
        reason,
        subtotal,
        taxBase,
        tvaAmount,
        tpsAmount,
        cssAmount,
        creditNoteTotal,
        'open',
        session.userId,
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
          Math.round(item.unitPrice),
          Math.round(item.quantity * item.unitPrice),
        );
      }

      // --- AN-5 FIX: Only cancel the invoice if the credit note covers its FULL total ---
      // Partial avoir → keep the current invoice status untouched.
      // Full avoir → transition invoice to 'cancelled' to reflect total write-off.
      const invoiceTotal = Math.round(invoice.total);
      if (creditNoteTotal >= invoiceTotal) {
        db.prepare("UPDATE invoices SET status = 'cancelled' WHERE id = ?").run(invoice.id);
      }
      // If partial, the invoice status remains unchanged (UNPAID / PARTIALLY_PAID / PAID)
      // The credit note is the audit record; the invoice retains its payment history.

      return { id, number };
    });

    const result = insertCreditNote();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Credit Notes POST] Error:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to create credit note' };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
