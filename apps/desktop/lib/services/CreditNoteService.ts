import db from '@/lib/db';
import crypto from 'crypto';
import { getNextNumber } from '@/lib/api/numbering';
import { DbInvoice, DbSettings, CreditNoteCreateRequest } from '@/lib/types/api';
import { INVOICE_STATUS } from '@/lib/constants';
import { computeTotals } from '@/lib/math-logic';
import { buildTenantFilter, resolveActiveTenantId } from '@/lib/api/tenant';

export class CreditNoteServiceError extends Error {
  constructor(public message: string, public status: number) {
    super(message);
  }
}

const getSettingsStmt = db.prepare('SELECT companyCode, tvaRate, tpsRate, cssRate FROM settings WHERE id = 1');
const insertCreditNoteStmt = db.prepare(`
  INSERT INTO credit_notes (
    id, number, invoiceId, clientId, clientName, date, reason,
    subtotal, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by, tenant_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertCreditNoteItemStmt = db.prepare(`
  INSERT INTO credit_note_items (id, creditNoteId, description, quantity, unitPrice, total, tenant_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const updateInvoiceStatusStmt = db.prepare(`UPDATE invoices SET status = '${INVOICE_STATUS.CANCELLED}' WHERE id = ?`);

export const CreditNoteService = {
  createCreditNote(data: CreditNoteCreateRequest, userId: string, tenantId?: string | null) {
    const { invoiceId, reason, items } = data;
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);

    const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ? AND deletedAt IS NULL${tf.sql}`).get(invoiceId, ...tf.params) as DbInvoice | undefined;
    if (!invoice) {
      throw new CreditNoteServiceError('Invoice not found', 404);
    }

    if (invoice.status === INVOICE_STATUS.CANCELLED) {
      throw new CreditNoteServiceError('Cannot create a credit note for an already cancelled invoice', 400);
    }

    const settings = getSettingsStmt.get() as (DbSettings & { tvaRate: number; tpsRate?: number; cssRate: number }) | undefined;
    if (!settings) {
      throw new CreditNoteServiceError('Settings not found', 500);
    }

    db.exec("INSERT OR IGNORE INTO sequences (name, current_value) VALUES ('credit_note', 0)");

    const id = crypto.randomUUID();
    const targetTenantId = invoice.tenant_id || activeTenantId;

    const insertCreditNote = db.transaction(() => {
      const number = getNextNumber('credit_note');

      const rates = {
        tvaRate: settings.tvaRate,
        tpsRate: settings.tpsRate ?? null,
        cssRate: settings.cssRate,
      };
      const computed = computeTotals(items, 0, rates);

      insertCreditNoteStmt.run(
        id,
        number,
        invoice.id,
        invoice.clientId,
        invoice.clientName,
        new Date().toISOString().split('T')[0],
        reason,
        computed.subtotal,
        computed.taxBase,
        computed.tvaAmount,
        computed.tpsAmount,
        computed.cssAmount,
        computed.total,
        'open',
        userId,
        targetTenantId
      );

      for (const item of items) {
        insertCreditNoteItemStmt.run(
          crypto.randomUUID(),
          id,
          item.description,
          item.quantity,
          Math.round(item.unitPrice),
          Math.round(item.quantity * item.unitPrice),
          targetTenantId
        );
      }

      const invoiceTotal = Math.round(invoice.total);
      if (computed.total >= invoiceTotal) {
        db.prepare(`UPDATE invoices SET status = '${INVOICE_STATUS.CANCELLED}' WHERE id = ?${tf.sql}`).run(invoice.id, ...tf.params);
      }

      return { id, number };
    });

    return insertCreditNote();
  }
};
