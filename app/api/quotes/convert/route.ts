import { logAudit } from '@/lib/api/audit';
import { QuoteService, QuoteServiceError } from '@/lib/services/QuoteService';
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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId) as { role: string } | undefined;
    if (!user || user.role !== 'user') {
      return NextResponse.json({ error: 'Unauthorized: Only Users can convert quotes' }, { status: 403 });
    }

    const body: unknown = await request.json();
    const validation = quoteConvertSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid request payload',
        details: validation.error.flatten(),
      }, { status: 400 });
    }

    const { quoteId } = validation.data;

    try {
      const response = QuoteService.convertToInvoice(quoteId, session.userId, session.role);

      logAudit('CREATE', 'invoice', response.invoiceId, `Devis converti en facture: ${response.invoiceNumber}`, session.userId, session.name || session.username || null);

      return NextResponse.json(response);
    } catch (error: any) {
      if (error instanceof QuoteServiceError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }

  } catch (error) {
    console.error('[API Quotes Convert POST] Error:', error);
    return NextResponse.json({ error: 'Failed to convert quote to invoice' }, { status: 500 });
  }
}
