import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import { quoteSchema } from '@/lib/validations';
import crypto from 'crypto';
import { logAudit } from '@/lib/api/audit';
import { getNextNumber } from '@/lib/api/numbering';
import type { QuoteCreateRequest, QuoteResponse, QuoteItem, ErrorResponse, DbQuote, DbQuoteItem } from '@/lib/types/api';

/**
 * GET /api/quotes
 * Fetch all quotes with their items
 * @returns {QuoteResponse[]} Array of quotes with items
 */
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
    `).all() as (DbQuote & { items: string })[];

    const formattedQuotes: QuoteResponse[] = quotes.map((q): QuoteResponse => ({
      ...q,
      items: JSON.parse(q.items || '[]') as QuoteItem[],
    }));

    return NextResponse.json(formattedQuotes);
  } catch (error) {
    console.error('[API Quotes GET] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch quotes',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * POST /api/quotes
 * Create a new quote with items
 * @param {QuoteCreateRequest} body - Quote data with items
 * @returns {{ id: string, number: string }} Created quote ID and number
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
        error: 'Unauthorized: Only Users can create quotes',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    const body: unknown = await request.json();

    // Validate request payload with Zod
    const validation = quoteSchema.safeParse(body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Données invalides',
        details: {
          fieldErrors: validation.error.flatten().fieldErrors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const data: QuoteCreateRequest = validation.data;
    const id = crypto.randomUUID();

    const insertQuote = db.transaction((quoteData) => {
      const number = getNextNumber('quote');

      db.prepare(`
        INSERT INTO quotes (
          id, number, clientId, clientName, clientEmail, date, dueDate,
          subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, number, quoteData.clientId, quoteData.clientName, quoteData.clientEmail, quoteData.date, quoteData.dueDate,
        Math.round(quoteData.subtotal), Math.round(quoteData.discount), Math.round(quoteData.taxBase),
        Math.round(quoteData.tvaAmount), Math.round(quoteData.tpsAmount || 0), Math.round(quoteData.cssAmount),
        Math.round(quoteData.total), quoteData.notes, quoteData.status
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
    console.error('[API Quotes POST] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to create quote',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
