import { CreditNoteService, CreditNoteServiceError } from '@/lib/services/CreditNoteService';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' } as ErrorResponse, { status: 401 });
    }

    let query = `
      SELECT cn.id, cn.number, cn.invoiceId, cn.clientId, cn.clientName, cn.date, cn.reason, cn.subtotal, cn.taxBase, cn.tvaAmount, cn.tpsAmount, cn.cssAmount, cn.total, cn.status, cn.createdAt, cn.deletedAt, cn.created_by,
             (SELECT json_group_array(json_object(
               'id', id,
               'description', description,
               'quantity', quantity,
               'unitPrice', unitPrice,
               'total', total
             )) FROM credit_note_items WHERE creditNoteId = cn.id) as items
      FROM credit_notes cn
      WHERE cn.deletedAt IS NULL
    `;
    const params: unknown[] = [];
    if (session.role !== 'admin') {
      query += ' AND cn.created_by = ?';
      params.push(session.userId);
    }
    query += ' ORDER BY createdAt DESC';

    const notes = db.prepare(query).all(...params) as (DbCreditNote & { items: string })[];

    const formatted: CreditNoteResponse[] = notes.map((n): CreditNoteResponse => ({
      ...n,
      items: JSON.parse(n.items || '[]') as CreditNoteItem[],
    }));

    const response = NextResponse.json(formatted);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  } catch (error) {
    console.error('[API Credit Notes GET] Error:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to fetch credit notes' };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}


export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' } as ErrorResponse, { status: 401 });
    }

    const body: unknown = await request.json();

    // --- Zod Validation ---
    const validation = creditNoteCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Données invalides',
        details: { fieldErrors: validation.error.flatten().fieldErrors },
      } as ErrorResponse, { status: 400 });
    }

    const data = validation.data;

    try {
      const result = CreditNoteService.createCreditNote(data, session.userId);
      logAudit('CREATE', 'credit_note', result.id, `Nouvel avoir créé: ${result.number}`, session.userId, session.name || session.username || null);
      return NextResponse.json(result);
    } catch (error: any) {
      if (error instanceof CreditNoteServiceError) {
        return NextResponse.json({ error: error.message } as ErrorResponse, { status: error.status });
      }
      throw error;
    }

  } catch (error) {
    console.error('[API Credit Notes POST] Error:', error);
    return NextResponse.json({ error: 'Failed to create credit note' } as ErrorResponse, { status: 500 });
  }
}
