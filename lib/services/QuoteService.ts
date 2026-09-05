import db from '@/lib/db';
import crypto from 'crypto';
import { getNextNumber } from '@/lib/api/numbering';
import { DbQuote, DbQuoteItem, DbSettings, QuoteConvertResponse } from '@/lib/types/api';
import { ROLES, QUOTE_STATUS, INVOICE_STATUS } from '@/lib/constants';

export class QuoteServiceError extends Error {
  constructor(public message: string, public status: number) {
    super(message);
  }
}

export const QuoteService = {
  convertToInvoice(quoteId: string, userId: string, role: string): QuoteConvertResponse {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId) as (DbQuote & { created_by?: string }) | undefined;

    if (!quote) {
      throw new QuoteServiceError('Quote not found', 404);
    }

    if (role !== ROLES.ADMIN && quote.created_by !== userId) {
      throw new QuoteServiceError('Forbidden: You can only convert your own quotes', 403);
    }

    if (quote.deletedAt !== null) {
      throw new QuoteServiceError('Cannot convert a deleted quote', 400);
    }

    if (quote.status === QUOTE_STATUS.CONVERTI) {
      throw new QuoteServiceError('Quote already converted', 400);
    }
    
    if (quote.validUntil && new Date() > new Date(quote.validUntil)) {
      throw new QuoteServiceError('Impossible de convertir : ce devis a expiré.', 400);
    }

    const items = db.prepare('SELECT * FROM quote_items WHERE quoteId = ?').all(quoteId) as DbQuoteItem[];

    const settings = db.prepare('SELECT invoicePrefix, companyCode FROM settings WHERE id = 1').get() as DbSettings | undefined;
    if (!settings) {
      throw new QuoteServiceError('Settings not found', 500);
    }

    const invoiceId = crypto.randomUUID();

    const insertInvoice = db.prepare(`
      INSERT INTO invoices (
        id, number, quoteId, clientId, clientName, clientEmail, date,
        subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, notes, subject, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateQuoteStatus = db.prepare(`UPDATE quotes SET status = ? WHERE id = ?`);

    const convert = db.transaction(() => {
      const number = getNextNumber('invoice');

      insertInvoice.run(
        invoiceId,
        number,
        quoteId,
        quote.clientId,
        quote.clientName,
        quote.clientEmail,
        new Date().toISOString().split('T')[0],
        Math.round(quote.subtotal),
        Math.round(quote.discount),
        Math.round(quote.taxBase),
        Math.round(quote.tvaAmount),
        Math.round(quote.tpsAmount || 0),
        Math.round(quote.cssAmount),
        Math.round(quote.total),
        INVOICE_STATUS.UNPAID,
        quote.notes,
        quote.subject ?? null,
        userId
      );

      for (const item of items) {
        insertItem.run(
          crypto.randomUUID(),
          invoiceId,
          item.description,
          item.quantity,
          Math.round(item.unitPrice),
          Math.round(item.total)
        );
      }

      updateQuoteStatus.run(QUOTE_STATUS.CONVERTI, quoteId);

      return {
        invoiceId,
        invoiceNumber: number,
        quoteId
      };
    });

    return convert();
  }
};
