import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import type { QuoteResponse, QuoteItem, ErrorResponse, DbQuote, DbQuoteItem } from '@/lib/types/api';

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
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ? AND deletedAt IS NULL').get(id) as DbQuote | undefined;
    if (!quote) {
      const errorResponse: ErrorResponse = {
        error: 'Quote not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const items = db.prepare('SELECT * FROM quote_items WHERE quoteId = ?').all(id) as DbQuoteItem[];

    const response: QuoteResponse = {
      ...quote,
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

    // RBAC Check - Only Admin can delete quotes
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      const errorResponse: ErrorResponse = {
        error: 'Forbidden: Only Admin can delete quotes',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    const quote = db.prepare('SELECT status, deletedAt FROM quotes WHERE id = ?').get(id) as DbQuote | undefined;
    if (!quote || quote.deletedAt !== null) {
      const errorResponse: ErrorResponse = {
        error: 'Quote not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Business rule: A quote cannot be deleted if it has already been converted to an invoice
    if (quote.status === 'CONVERTI') {
      const errorResponse: ErrorResponse = {
        error: 'Impossible de supprimer un devis déjà converti en facture.',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Soft delete
    db.prepare("UPDATE quotes SET deletedAt = datetime('now'), status = 'rejected' WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Quotes DELETE] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to delete quote',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
