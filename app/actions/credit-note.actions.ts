"use server";

import { CreditNoteService, CreditNoteServiceError } from '@/lib/services/CreditNoteService';
import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import db from '@/lib/db';
import { updateInvoiceStatus } from '@/lib/api/invoice-logic';
import { creditNoteCreateSchema } from '@/lib/validations';
import type {
  CreditNoteCreateRequest,
  CreditNoteResponse,
  CreditNoteItem,
  DbCreditNote,
  DbCreditNoteItem,
} from '@/lib/types/api';
import type { ActionResponse } from './client.actions';

export async function getCreditNotes(): Promise<ActionResponse<CreditNoteResponse[]>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

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

    return { success: true, data: formatted };
  } catch (error) {
    console.error('[Action getCreditNotes] Error:', error);
    return { success: false, error: 'Failed to fetch credit notes' };
  }
}

export async function getCreditNoteById(id: string): Promise<ActionResponse<CreditNoteResponse>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const note = db.prepare('SELECT * FROM credit_notes WHERE id = ? AND deletedAt IS NULL').get(id) as DbCreditNote | undefined;
    if (!note) return { success: false, error: 'Credit note not found' };

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

    return { success: true, data: response };
  } catch (error) {
    console.error('[Action getCreditNoteById] Error:', error);
    return { success: false, error: 'Failed to fetch credit note' };
  }
}

export async function createCreditNote(data: CreditNoteCreateRequest): Promise<ActionResponse<CreditNoteResponse>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };

    const validation = creditNoteCreateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const validData = validation.data;

    try {
      const result = CreditNoteService.createCreditNote(validData, session.userId);
      logAudit('CREATE', 'credit_note', result.id, `Nouvel avoir créé: ${result.number}`, session.userId, session.name || session.username || null);
      return { success: true, data: result as CreditNoteResponse };
    } catch (error: any) {
      if (error instanceof CreditNoteServiceError) {
        return { success: false, error: error.message };
      }
      throw error;
    }
  } catch (error) {
    console.error('[Action createCreditNote] Error:', error);
    return { success: false, error: 'Failed to create credit note' };
  }
}

export async function deleteCreditNote(id: string): Promise<ActionResponse<boolean>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };
    if (session.role !== 'admin') return { success: false, error: 'Forbidden' };

    const note = db.prepare('SELECT * FROM credit_notes WHERE id = ? AND deletedAt IS NULL').get(id) as DbCreditNote | undefined;
    if (!note) return { success: false, error: 'Credit note not found' };

    const deleteResult = db.transaction(() => {
      const result = db.prepare("UPDATE credit_notes SET deletedAt = datetime('now'), status = 'cancelled' WHERE id = ?").run(id);

      if (result.changes === 0) return null;

      logAudit('DELETE', 'credit_note', id, `Avoir supprimé: ${note.number || id}`, session.userId, session.name || session.username || null);

      if (note.invoiceId) {
        try {
          updateInvoiceStatus(note.invoiceId);
        } catch {
          console.warn(`[Action deleteCreditNote] Could not recalculate status for invoice: ${note.invoiceId}`);
        }
      }
      return { success: true };
    })();

    if (!deleteResult) return { success: false, error: 'Credit note not found' };

    return { success: true, data: true };
  } catch (error) {
    console.error('[Action deleteCreditNote] Error:', error);
    return { success: false, error: 'Failed to delete credit note' };
  }
}
