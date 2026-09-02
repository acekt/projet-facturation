import db from '@/lib/db';
import crypto from 'crypto';
import { getNextNumber } from '@/lib/api/numbering';
import { DbInvoice, DbSettings, CreditNoteCreateRequest } from '@/lib/types/api';
import { calculateFiscalCascade } from '@/lib/fiscal';
import { INVOICE_STATUS } from '@/lib/constants';
import { computeTotals } from '@/lib/api/invoice-logic';

export class CreditNoteServiceError extends Error {
  constructor(public message: string, public status: number) {
    super(message);
  }
}

export const CreditNoteService = {
  createCreditNote(data: CreditNoteCreateRequest, userId: string) {
    const { invoiceId, reason, items } = data;

    const invoice = db
      .prepare('SELECT * FROM invoices WHERE id = ? AND deletedAt IS NULL')
      .get(invoiceId) as DbInvoice | undefined;
    if (!invoice) {
      throw new CreditNoteServiceError('Invoice not found', 404);
    }

    // Check if the invoice is already cancelled
    if (invoice.status === INVOICE_STATUS.CANCELLED) {
      throw new CreditNoteServiceError('Cannot create a credit note for an already cancelled invoice', 400);
    }

    const settings = db
      .prepare('SELECT companyCode, tvaRate, tpsRate, cssRate FROM settings WHERE id = 1')
      .get() as (DbSettings & { tvaRate: number; tpsRate?: number; cssRate: number }) | undefined;
    if (!settings) {
      throw new CreditNoteServiceError('Settings not found', 500);
    }

    db.exec("INSERT OR IGNORE INTO sequences (name, current_value) VALUES ('credit_note', 0)");

    const id = crypto.randomUUID();

    const insertCreditNote = db.transaction(() => {
      const number = getNextNumber('credit_note');

      // --- AN-4 FIX: Compute all financial totals SERVER-SIDE ---
      const rates = {
        tvaRate: settings.tvaRate,
        tpsRate: settings.tpsRate ?? null,
        cssRate: settings.cssRate,
      };
      const computed = computeTotals(items, 0, rates);

      db.prepare(`
        INSERT INTO credit_notes (
          id, number, invoiceId, clientId, clientName, date, reason,
          subtotal, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
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
        userId
      );

      const insertItem = db.prepare(`
        INSERT INTO credit_note_items (id, creditNoteId, description, quantity, unitPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(
          crypto.randomUUID(),
          id,
          item.description,
          item.quantity,
          Math.round(item.unitPrice),
          Math.round(item.quantity * item.unitPrice)
        );
      }

      // --- AN-5 FIX: Only cancel the invoice if the credit note covers its FULL total ---
      const invoiceTotal = Math.round(invoice.total);
      if (computed.total >= invoiceTotal) {
        db.prepare(`UPDATE invoices SET status = '${INVOICE_STATUS.CANCELLED}' WHERE id = ?`).run(invoice.id);
      }

      return { id, number };
    });

    return insertCreditNote();
  }
};
