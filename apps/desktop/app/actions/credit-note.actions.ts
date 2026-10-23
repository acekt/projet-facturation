"use server";

import { CreditNoteService, CreditNoteServiceError } from '@/lib/services/CreditNoteService';
import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import { buildTenantFilter, resolveActiveTenantId } from '@/lib/api/tenant';
import db from '@/lib/db';
import { updateInvoiceStatus } from '@/lib/api/invoice-logic';
import { creditNoteCreateSchema } from '@/lib/validations';
import { assertLicenseAllowsCreation, LicenseRestrictedError } from '@/lib/api/license';
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
    if (!session || (session.role !== 'admin' && session.role !== 'user')) {
      return { success: false, error: 'Unauthorized' };
    }

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const tf = buildTenantFilter(activeTenantId, 'cn');
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
      WHERE cn.deletedAt IS NULL${tf.sql}
    `;
    const params: unknown[] = [...tf.params];
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
    if (!session || (session.role !== 'admin' && session.role !== 'user')) {
      return { success: false, error: 'Unauthorized' };
    }

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const tf = buildTenantFilter(activeTenantId);
    const note = db.prepare(`SELECT * FROM credit_notes WHERE id = ? AND deletedAt IS NULL${tf.sql}`).get(id, ...tf.params) as DbCreditNote | undefined;
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
    if (!session || !session.userId || (session.role !== 'admin' && session.role !== 'user')) {
      return { success: false, error: 'Unauthorized' };
    }

    const validation = creditNoteCreateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const validData = validation.data;
    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);

    // Contrôle de licence : bloquer la création si le tenant est en lecture seule
    try {
      assertLicenseAllowsCreation(activeTenantId);
    } catch (licErr: any) {
      if (licErr instanceof LicenseRestrictedError) {
        return { success: false, error: licErr.message };
      }
      throw licErr;
    }

    try {
      const result = CreditNoteService.createCreditNote(validData, session.userId, activeTenantId);
      logAudit('CREATE', 'credit_note', result.id, `Nouvel avoir créé: ${result.number}`, session.userId, session.name || session.username || null, activeTenantId);
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

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const tf = buildTenantFilter(activeTenantId);
    const note = db.prepare(`SELECT * FROM credit_notes WHERE id = ? AND deletedAt IS NULL${tf.sql}`).get(id, ...tf.params) as DbCreditNote | undefined;
    if (!note) return { success: false, error: 'Credit note not found' };

    const deleteResult = db.transaction(() => {
      const result = db.prepare(`UPDATE credit_notes SET deletedAt = datetime('now'), status = 'cancelled' WHERE id = ?${tf.sql}`).run(id, ...tf.params);

      if (result.changes === 0) return null;

      logAudit('DELETE', 'credit_note', id, `Avoir supprimé: ${note.number || id}`, session.userId, session.name || session.username || null, activeTenantId);

      if (note.invoiceId) {
        try {
          updateInvoiceStatus(note.invoiceId, activeTenantId);
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
