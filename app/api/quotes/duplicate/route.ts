import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import crypto from 'crypto';
import { quoteDuplicateSchema } from '@/lib/validations';
import type { QuoteDuplicateRequest, QuoteDuplicateResponse, ErrorResponse, DbQuote, DbQuoteItem, DbSettings, DbSequence } from '@/lib/types/api';

/**
 * POST /api/quotes/duplicate
 * Duplicate an existing quote with a new number
 * @param {QuoteDuplicateRequest} body - Quote ID to duplicate
 * @returns {QuoteDuplicateResponse} New quote ID and number
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
        error: 'Unauthorized: Only Users can duplicate quotes',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    const body: unknown = await request.json();

    // Validate request payload with Zod
    const validation = quoteDuplicateSchema.safeParse(body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Données invalides',
        details: {
          fieldErrors: validation.error.flatten().fieldErrors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { quoteId }: QuoteDuplicateRequest = validation.data;

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId) as DbQuote | undefined;
    if (!quote) {
      const errorResponse: ErrorResponse = {
        error: 'Quote not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const items = db.prepare('SELECT * FROM quote_items WHERE quoteId = ?').all(quoteId) as DbQuoteItem[];

    const settings = db.prepare('SELECT quotePrefix, companyCode FROM settings WHERE id = 1').get() as DbSettings | undefined;
    if (!settings) {
      const errorResponse: ErrorResponse = {
        error: 'Settings not found',
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    const year = new Date().getFullYear();
    const newId = crypto.randomUUID();

    const duplicate = db.transaction(() => {
      db.prepare("UPDATE sequences SET current_value = current_value + 1 WHERE name = 'quote'").run();
      const sequence = db.prepare("SELECT current_value FROM sequences WHERE name = 'quote'").get() as DbSequence;
      const number = `${String(sequence.current_value).padStart(3, '0')}/${settings.companyCode}/${year}`;

      db.prepare(`
        INSERT INTO quotes (
          id, number, clientId, clientName, clientEmail, date,
          subtotal, discount, taxBase, tvaAmount, cssAmount, total, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newId,
        number,
        quote.clientId,
        quote.clientName,
        quote.clientEmail,
        new Date().toISOString().split('T')[0],
        quote.subtotal,
        quote.discount,
        quote.taxBase,
        quote.tvaAmount,
        quote.cssAmount,
        quote.total,
        quote.notes,
        'EN_ATTENTE'
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

      const response: QuoteDuplicateResponse = {
        quoteId: newId,
        quoteNumber: number,
      };
      return response;
    });

    const result = duplicate();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Quotes Duplicate POST] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Duplication failed',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
