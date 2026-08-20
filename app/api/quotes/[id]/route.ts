import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import { QuoteRepository } from '@/lib/repositories/QuoteRepository';
import { quoteSchema } from '@/lib/validations';
import { computeTotals, getTaxRates } from '@/lib/api/invoice-logic';
import crypto from 'crypto';
import { logAudit } from '@/lib/api/audit';
import { validateQuoteStatusTransition } from '@/lib/api/quote-logic';
import type { QuoteResponse, QuoteItem, ErrorResponse, DbQuote, DbQuoteItem } from '@/lib/types/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quotes/[id]
 * Fetch a specific quote by ID with its items
 * @param {string} id - Quote ID
 * @returns {QuoteResponse} Quote with items
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Authentication required',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    const quote = QuoteRepository.findById(id, session.userId, session.role);
    if (!quote) {
      const exists = QuoteRepository.findById(id);
      if (exists) {
        return NextResponse.json({ error: 'Forbidden: You can only access your own quotes' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const items = db.prepare('SELECT * FROM quote_items WHERE quoteId = ?').all(id) as DbQuoteItem[];

    const response: QuoteResponse = {
      ...quote,
      deletedAt: quote.deletedAt ?? undefined,
      items: items.map((item): QuoteItem => ({
        id: item.id,
        quoteId: item.quoteId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API Quotes GET by ID] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch quote',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * PUT /api/quotes/[id]
 * Update an existing quote. Recalculates all totals server-side.
 * Business rule: Cannot update a quote that has been converted to an invoice.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Fetch existing quote
    const existingQuote = QuoteRepository.findWithStatus(id, session.userId, session.role);
    if (!existingQuote || existingQuote.deletedAt !== null) {
      const exists = QuoteRepository.findWithStatus(id);
      if (exists && exists.deletedAt === null) {
        return NextResponse.json({ error: 'Forbidden: You can only update your own quotes' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (existingQuote.status === 'CONVERTI') {
      const errorResponse: ErrorResponse = {
        error: 'Impossible de modifier un devis déjà converti en facture.',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const body: unknown = await request.json();

    // Validate with Zod
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

    const data = validation.data;

    // Recalculate totals server-side
    const rates = getTaxRates();
    const computed = computeTotals(data.items, data.discount, rates);

    const updateQuoteTx = db.transaction((quoteItems: any[]) => {
      // Update quote header
      db.prepare(`
        UPDATE quotes
        SET clientId = ?, clientName = ?, clientEmail = ?, date = ?,
            subtotal = ?, discount = ?, taxBase = ?, tvaAmount = ?, tpsAmount = ?, cssAmount = ?,
            total = ?, notes = ?
        WHERE id = ?
      `).run(
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
        id
      );

      // Clear existing items
      db.prepare('DELETE FROM quote_items WHERE quoteId = ?').run(id);

      // Insert new items
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
          Math.round(item.quantity * item.unitPrice)
        );
      }

      logAudit('UPDATE', 'quote', id, `Devis modifié: ${id}`, session.userId, session.name || session.username || null);
      return { id };
    });

    const result = updateQuoteTx(data.items);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Quotes PUT] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to update quote',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * DELETE /api/quotes/[id]
 * Soft delete a quote (Admin only)
 * Business rule: Cannot delete a quote that has been converted to an invoice
 * @param {string} id - Quote ID
 * @returns {{ success: boolean }} Success indicator
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // RBAC Check
    const session = await getSession();
    if (!session || !session.userId) {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Authentication required',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    const quote = QuoteRepository.findWithStatus(id, session.userId, session.role);
    if (!quote || quote.deletedAt !== null) {
      const exists = QuoteRepository.findWithStatus(id);
      if (exists && exists.deletedAt === null) {
        return NextResponse.json({ error: 'Forbidden: You can only delete your own quotes' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Business rule: A quote cannot be deleted if it has already been converted to an invoice
    if (quote.status === 'CONVERTI') {
      const errorResponse: ErrorResponse = {
        error: 'Impossible de supprimer un devis déjà converti en facture.',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // AN-3 FIX: Soft delete using deletedAt as the sole marker of deletion.
    // The original status (EN_ATTENTE) is preserved for fiscal audit purposes.
    // 'rejected' was a phantom status from a legacy version — removed.
    QuoteRepository.softDelete(id, session.userId, session.role);
    logAudit('DELETE', 'quote', id, `Devis supprimé: ${quote.number || id}`, session.userId, session.name || session.username || null);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Quotes DELETE] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to delete quote',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * PATCH /api/quotes/[id]
 * Transition quote status (e.g. EN_ATTENTE -> ENVOYE, REFUSE, CONVERTI)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (!session.userId) {
      return NextResponse.json({ error: 'User ID manquant dans la session' }, { status: 400 });
    }

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId) as { role: string } | undefined;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quote = QuoteRepository.findWithStatus(id, session.userId, session.role);
    if (!quote || quote.deletedAt !== null) {
      const exists = QuoteRepository.findWithStatus(id);
      if (exists && exists.deletedAt === null) {
        return NextResponse.json({ error: 'Forbidden: You can only update your own quotes' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const body = await request.json() as { status?: string };
    if (!body.status) {
      return NextResponse.json({ error: 'Statut requis' }, { status: 400 });
    }

    if (!validateQuoteStatusTransition(quote.status, body.status)) {
      return NextResponse.json(
        { error: `Transition de statut impossible : de ${quote.status} à ${body.status}` },
        { status: 400 }
      );
    }

    QuoteRepository.updateStatus(id, body.status, session.userId, session.role);
    logAudit('UPDATE', 'quote', id, `Changement de statut devis: ${quote.status} -> ${body.status}`, session.userId, session.name || session.username || null);

    return NextResponse.json({ success: true, status: body.status });
  } catch (error) {
    console.error('[API Quotes PATCH] Error:', error);
    return NextResponse.json({ error: 'Failed to update quote status' }, { status: 500 });
  }
}
