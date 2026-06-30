import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { invoiceSchema } from '@/lib/validations';
import { computeTotals, getTaxRates } from '@/lib/api/invoice-logic';
import crypto from 'crypto';
import { logAudit } from '@/lib/api/audit';
import { getNextNumber } from '@/lib/api/numbering';
import { getSession } from '@/lib/api/auth';
import type {
  InvoiceResponse,
  InvoiceItem,
  PaymentResponse,
  ErrorResponse,
  DbInvoice,
  DbClient,
} from '@/lib/types/api';

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
             )) FROM payments WHERE invoiceId = i.id AND deletedAt IS NULL) as payments
      FROM invoices i
      WHERE i.deletedAt IS NULL
      ORDER BY createdAt DESC
    `).all() as (DbInvoice & { items: string; payments: string })[];

    const formattedInvoices: InvoiceResponse[] = invoices.map((i): InvoiceResponse => ({
      ...i,
      items: JSON.parse(i.items || '[]') as InvoiceItem[],
      payments: JSON.parse(i.payments || '[]') as PaymentResponse[],
    }));

    return NextResponse.json(formattedInvoices);
  } catch (error) {
    console.error('[API Invoices GET] Error:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to fetch invoices' };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' } as ErrorResponse, { status: 401 });
    }

    const body: unknown = await request.json();

    // --- Zod Validation ---
    const validation = invoiceSchema.safeParse(body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Données invalides',
        details: { fieldErrors: validation.error.flatten().fieldErrors },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const data = validation.data;

    // --- AN-1 FIX: Validate clientId against active (non-soft-deleted) clients ---
    const client = db
      .prepare('SELECT id FROM clients WHERE id = ? AND deletedAt IS NULL')
      .get(data.clientId) as DbClient | undefined;
    if (!client) {
      const errorResponse: ErrorResponse = {
        error: 'Client introuvable ou supprimé. Impossible de créer une facture pour ce client.',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // --- Validate linked quote (if any) ---
    if (data.quoteId) {
      const quote = db
        .prepare('SELECT status, deletedAt FROM quotes WHERE id = ?')
        .get(data.quoteId) as { status: string; deletedAt: string | null } | undefined;

      if (!quote) {
        return NextResponse.json(
          { error: 'Devis introuvable.' } as ErrorResponse,
          { status: 400 }
        );
      }
      if (quote.deletedAt !== null) {
        return NextResponse.json(
          { error: 'Le devis associé a été supprimé.' } as ErrorResponse,
          { status: 400 }
        );
      }
      // AN-Bonus FIX: was checking 'invoiced' (old value), now using correct 'CONVERTI'
      if (quote.status === 'CONVERTI') {
        return NextResponse.json(
          { error: 'Ce devis a déjà été converti en facture.' } as ErrorResponse,
          { status: 400 }
        );
      }
    }

    // --- AN-4 FIX: Compute all financial totals SERVER-SIDE ---
    const rates = getTaxRates();
    const computed = computeTotals(data.items, data.discount, rates);

    const id = crypto.randomUUID();

    const insertInvoice = db.transaction(() => {
      const number = getNextNumber('invoice');

      db.prepare(`
        INSERT INTO invoices (
          id, number, quoteId, clientId, clientName, clientEmail, date,
          subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        number,
        data.quoteId ?? null,
        data.clientId,
        data.clientName,
        data.clientEmail,
        data.date,
        computed.subtotal,
        computed.discount,
        computed.taxBase,
        computed.tvaAmount,
        computed.tpsAmount,
        computed.cssAmount,
        computed.total,
        'UNPAID', // Always starts as UNPAID — payments drive status transitions
        data.notes ?? null,
      );

      const insertItem = db.prepare(`
        INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of data.items) {
        insertItem.run(
          crypto.randomUUID(),
          id,
          item.description,
          item.quantity,
          Math.round(item.unitPrice),
          Math.round(item.quantity * item.unitPrice),
        );
      }

      // Atomic quote status transition
      if (data.quoteId) {
        db.prepare("UPDATE quotes SET status = 'CONVERTI' WHERE id = ?").run(data.quoteId);
      }

      logAudit('CREATE', 'invoice', id, `Nouvelle facture créée: ${number}`);
      return { id, number };
    });

    const result = insertInvoice();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Invoices POST] Error:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to create invoice' };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
