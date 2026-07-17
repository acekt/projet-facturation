import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import crypto from 'crypto';
import { getNextNumber } from '@/lib/api/numbering';
import { quoteConvertSchema } from '@/lib/validations';
import type { QuoteConvertRequest, QuoteConvertResponse, ErrorResponse, DbQuote, DbQuoteItem, DbSettings, DbSequence } from '@/lib/types/api';

/**
 * POST /api/quotes/convert
 * Convert a quote to an invoice
 * Business rule: Quote status transition to 'invoiced' is atomic
 * @param {QuoteConvertRequest} body - Quote ID to convert
 * @returns {QuoteConvertResponse} Created invoice ID and number
 */
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
        error: 'Unauthorized: Only Users can convert quotes',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    const body: unknown = await request.json();

    // Validate request payload with Zod
    const validation = quoteConvertSchema.safeParse(body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Données invalides',
        details: {
          fieldErrors: validation.error.flatten().fieldErrors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { quoteId }: QuoteConvertRequest = validation.data;

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId) as (DbQuote & { created_by?: string }) | undefined;
    if (!quote) {
      const errorResponse: ErrorResponse = {
        error: 'Quote not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    if (session.role !== 'admin' && quote.created_by !== session.userId) {
      const errorResponse: ErrorResponse = {
        error: 'Forbidden: You can only convert your own quotes',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    if (quote.deletedAt !== null) {
      const errorResponse: ErrorResponse = {
        error: 'Cannot convert a deleted quote',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (quote.status === 'CONVERTI') {
      const errorResponse: ErrorResponse = {
        error: 'Quote already converted',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const items = db.prepare('SELECT * FROM quote_items WHERE quoteId = ?').all(quoteId) as DbQuoteItem[];

    const settings = db.prepare('SELECT invoicePrefix, companyCode FROM settings WHERE id = 1').get() as DbSettings | undefined;
    if (!settings) {
      const errorResponse: ErrorResponse = {
        error: 'Settings not found',
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    const invoiceId = crypto.randomUUID();

    const convert = db.transaction(() => {
      const number = getNextNumber('invoice');

      // Create invoice
      db.prepare(`
        INSERT INTO invoices (
          id, number, quoteId, clientId, clientName, clientEmail, date,
          subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId,
        number,
        quoteId,
        quote.clientId,
        quote.clientName,
        quote.clientEmail,
        new Date().toISOString().split('T')[0],
        Math.round(quote.subtotal),
        Math.round(quote.discount),
        Math.round(quote.taxBase),
        Math.round(quote.tvaAmount),
        Math.round(quote.tpsAmount || 0),
        Math.round(quote.cssAmount),
        Math.round(quote.total),
        'UNPAID',
        quote.notes,
        session.userId
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

      // Atomic status transition: quote -> CONVERTI
      db.prepare("UPDATE quotes SET status = 'CONVERTI' WHERE id = ?").run(quoteId);

      const response: QuoteConvertResponse = {
        invoiceId,
        invoiceNumber: number,
        quoteId,
      };
      return response;
    });

    const result = convert();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Quotes Convert POST] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Conversion failed',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
