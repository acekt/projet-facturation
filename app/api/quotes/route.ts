import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import { QuoteRepository } from '@/lib/repositories/QuoteRepository';
import { quoteSchema } from '@/lib/validations';
import { getTaxRates } from '@/lib/api/invoice-logic';
import { computeTotals } from '@/lib/math-logic';
import crypto from 'crypto';
import { logAudit } from '@/lib/api/audit';
import { getNextNumber } from '@/lib/api/numbering';
import type {
  QuoteCreateRequest,
  QuoteResponse,
  QuoteItem,
  ErrorResponse,
  DbQuote,
  DbClient,
} from '@/lib/types/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/quotes
 * Fetch all non-deleted quotes with their items.
 */
export async function GET(_request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' } as ErrorResponse, { status: 401 });
    }

    const quotes = QuoteRepository.findAll(session.userId, session.role);

    const formattedQuotes: QuoteResponse[] = quotes.map((q): QuoteResponse => ({
      ...q,
      deletedAt: q.deletedAt ?? undefined,
      items: JSON.parse(q.items || '[]') as QuoteItem[],
    }));

    const response = NextResponse.json(formattedQuotes);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  } catch (error) {
    console.error('[API Quotes GET] Error:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to fetch quotes' };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * POST /api/quotes
 * Create a new quote with server-side computed totals.
 * RBAC: Only 'user' (Opérateur) can create quotes.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Authentication required',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }
    if (!session.userId) {
      const errorResponse: ErrorResponse = {
        error: 'User ID manquant dans la session',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const user = db
      .prepare('SELECT role FROM users WHERE id = ?')
      .get(session.userId) as { role: string } | undefined;
    if (!user || user.role !== 'user') {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Only Users can create quotes',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    const body: unknown = await request.json();

    // --- Zod Validation ---
    const validation = quoteSchema.safeParse(body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Données invalides',
        details: { fieldErrors: validation.error.flatten().fieldErrors },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const data = validation.data as QuoteCreateRequest;

    // --- AN-2 FIX: Validate clientId against active (non-soft-deleted) clients ---
    const client = db
      .prepare('SELECT id FROM clients WHERE id = ? AND deletedAt IS NULL')
      .get(data.clientId) as DbClient | undefined;
    if (!client) {
      const errorResponse: ErrorResponse = {
        error: 'Client introuvable ou supprimé. Impossible de créer un devis pour ce client.',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // --- AN-4 FIX: Compute all financial totals SERVER-SIDE ---
    const rates = getTaxRates();
    const computed = computeTotals(data.items, data.discount, rates);

    const id = crypto.randomUUID();

    const insertQuote = db.transaction((quoteItems: any[]) => {
      const number = getNextNumber('quote');

      db.prepare(`
        INSERT INTO quotes (
          id, number, clientId, clientName, clientEmail, date,
          subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount,
          total, notes, subject, validUntil, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        number,
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
        data.notes ?? null,
        data.subject ?? null,
        data.validUntil ?? null,
        'EN_ATTENTE', // Status is always set server-side, never trusted from client
        session.userId,
      );

      const insertItem = db.prepare(`
        INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of quoteItems) {
        insertItem.run(
          crypto.randomUUID(),
          id,
          item.description,
          item.quantity,
          Math.round(item.unitPrice),
          Math.round(item.quantity * item.unitPrice),
        );
      }

      logAudit('CREATE', 'quote', id, `Nouveau devis créé: ${number}`, session.userId, session.name || session.username || null);
      return { id, number };
    });

    const result = insertQuote(data.items);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Quotes POST] Error:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to create quote' };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
