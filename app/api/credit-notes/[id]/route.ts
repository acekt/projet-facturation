import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import db from '@/lib/db';
import { updateInvoiceStatus } from '@/lib/api/invoice-logic';
import type { CreditNoteResponse, CreditNoteItem, ErrorResponse, DbCreditNote, DbCreditNoteItem } from '@/lib/types/api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
  { params }: { params: Promise<{ id: string }> }
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
    if (!session.userId) {
      const errorResponse: ErrorResponse = {
        error: 'User ID manquant dans la session',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Get credit note details before soft delete
    const note = db.prepare('SELECT * FROM credit_notes WHERE id = ? AND deletedAt IS NULL').get(id) as DbCreditNote | undefined;
    if (!note) {
      const errorResponse: ErrorResponse = {
        error: 'Credit note not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // AN-6 FIX: Soft delete the credit note inside a transaction,
    // then recalculate invoice status from ACTUAL payments instead of forcing 'UNPAID'.
    const deleteResult = db.transaction(() => {
      const result = db.prepare("UPDATE credit_notes SET deletedAt = datetime('now'), status = 'cancelled' WHERE id = ?").run(id);

      if (result.changes === 0) {
        return null;
      }

      logAudit('DELETE', 'credit_note', id, `Avoir supprimé: ${note.number || id}`, session.userId, session.name || session.username || null);

      // Recalculate invoice status based on sum of remaining (non-deleted) payments.
      // This correctly handles the case where the invoice had partial payments before the avoir:
      // instead of resetting to 'UNPAID', it transitions to the accurate state.
      if (note.invoiceId) {
        try {
          updateInvoiceStatus(note.invoiceId);
        } catch {
          // Invoice may have been soft-deleted independently; this is non-blocking.
          console.warn(`[Credit Notes DELETE] Could not recalculate status for invoice: ${note.invoiceId}`);
        }
      }

      return { success: true };
    })();

    if (!deleteResult) {
      const errorResponse: ErrorResponse = { error: 'Credit note not found' };
      return NextResponse.json(errorResponse, { status: 404 });
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
