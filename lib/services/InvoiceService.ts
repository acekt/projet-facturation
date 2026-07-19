import db from '@/lib/db';
import crypto from 'crypto';
import { getNextNumber } from '@/lib/api/numbering';
import { DbClient } from '@/lib/types/api';
import { ROLES, QUOTE_STATUS, INVOICE_STATUS } from '@/lib/constants';
import { computeTotals, getTaxRates } from '@/lib/api/invoice-logic';

export class InvoiceServiceError extends Error {
  constructor(public message: string, public status: number) {
    super(message);
  }
}

export const InvoiceService = {
  createInvoice(data: any, userId: string, role: string) {
    // Validate client
    const client = db
      .prepare('SELECT id FROM clients WHERE id = ? AND deletedAt IS NULL')
      .get(data.clientId) as DbClient | undefined;
    if (!client) {
      throw new InvoiceServiceError('Client introuvable ou supprimé. Impossible de créer une facture pour ce client.', 400);
    }

    // Validate linked quote
    if (data.quoteId) {
      const quote = db
        .prepare('SELECT status, deletedAt, created_by FROM quotes WHERE id = ?')
        .get(data.quoteId) as { status: string; deletedAt: string | null; created_by?: string } | undefined;

      if (!quote) {
        throw new InvoiceServiceError('Devis introuvable.', 400);
      }
      if (role !== ROLES.ADMIN && quote.created_by !== userId) {
        throw new InvoiceServiceError('Forbidden: You can only invoice your own quotes', 403);
      }
      if (quote.deletedAt !== null) {
        throw new InvoiceServiceError('Le devis associé a été supprimé.', 400);
      }
      if (quote.status === QUOTE_STATUS.CONVERTI) {
        throw new InvoiceServiceError('Ce devis a déjà été converti en facture.', 400);
      }
    }

    const rates = getTaxRates();
    const computed = computeTotals(data.items, data.discount, rates);

    const id = crypto.randomUUID();

    const insertInvoice = db.transaction(() => {
      const number = getNextNumber('invoice');

      db.prepare(`
        INSERT INTO invoices (
          id, number, quoteId, clientId, clientName, clientEmail, date,
          subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        number,
        data.quoteId ?? null,
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
        INVOICE_STATUS.UNPAID,
        data.notes ?? null,
        userId,
      );

      const insertItem = db.prepare(`
        INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of data.items) {
        insertItem.run(
          crypto.randomUUID(),
          id,
          item.description,
          item.quantity,
          Math.round(item.unitPrice),
          Math.round(item.quantity * item.unitPrice),
        );
      }

      if (data.quoteId) {
        db.prepare(`UPDATE quotes SET status = '${QUOTE_STATUS.CONVERTI}' WHERE id = ?`).run(data.quoteId);
      }

      return { id, number };
    });

    return insertInvoice();
  }
};
