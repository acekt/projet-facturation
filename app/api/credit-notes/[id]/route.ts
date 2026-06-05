import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import type { CreditNoteResponse, CreditNoteItem, ErrorResponse, DbCreditNote, DbCreditNoteItem } from '@/lib/types/api';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const note = db.prepare('SELECT * FROM credit_notes WHERE id = ? AND deletedAt IS NULL').get(id) as DbCreditNote | undefined;
    if (!note) {
      const errorResponse: ErrorResponse = {
        error: 'Credit note not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const items = db.prepare('SELECT * FROM credit_note_items WHERE creditNoteId = ?').all(id) as DbCreditNoteItem[];

    const response: CreditNoteResponse = {
      ...note,
      items: items.map((item): CreditNoteItem => ({
        id: item.id,
        creditNoteId: item.creditNoteId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API Credit Notes GET by ID] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch credit note',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    // RBAC Check - Only Admin can delete credit notes
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      const errorResponse: ErrorResponse = {
        error: 'Forbidden: Only Admin can delete credit notes',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    // Get credit note details before soft delete
    const note = db.prepare('SELECT * FROM credit_notes WHERE id = ? AND deletedAt IS NULL').get(id) as DbCreditNote | undefined;
    if (!note) {
      const errorResponse: ErrorResponse = {
        error: 'Credit note not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Soft delete the credit note
    const result = db.prepare("UPDATE credit_notes SET deletedAt = datetime('now'), status = 'cancelled' WHERE id = ?").run(id);

    if (result.changes === 0) {
      const errorResponse: ErrorResponse = {
        error: 'Credit note not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Optionally restore the linked invoice status if needed
    if (note.invoiceId) {
      db.prepare("UPDATE invoices SET status = 'UNPAID' WHERE id = ?").run(note.invoiceId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Credit Notes DELETE] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to delete credit note',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
