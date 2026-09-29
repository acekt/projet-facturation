import db from '@/lib/db';
import crypto from 'crypto';
import { getNextNumber } from '@/lib/api/numbering';
import { DbQuote, DbQuoteItem, DbSettings, QuoteConvertResponse, QuoteDuplicateResponse } from '@/lib/types/api';
import { ROLES, QUOTE_STATUS, INVOICE_STATUS } from '@/lib/constants';

export class QuoteServiceError extends Error {
  constructor(public message: string, public status: number) {
    super(message);
  }
}

const insertInvoiceStmt = db.prepare(`
  INSERT INTO invoices (
    id, number, quoteId, clientId, clientName, clientEmail, date,
    subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, notes, subject, created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertItemStmt = db.prepare(`
  INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const updateQuoteStatusStmt = db.prepare(`UPDATE quotes SET status = ? WHERE id = ?`);

const insertAuditLogStmt = db.prepare(`
  INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// ─── Statements pré-compilés pour la duplication de devis (module-level)
const selectQuoteForDuplicateStmt = db.prepare(
  'SELECT * FROM quotes WHERE id = ? AND deletedAt IS NULL'
);

const selectQuoteItemsForDuplicateStmt = db.prepare(
  'SELECT * FROM quote_items WHERE quoteId = ?'
);

const insertDuplicateQuoteStmt = db.prepare(`
  INSERT INTO quotes (
    id, number, clientId, clientName, clientEmail, date,
    subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total,
    notes, subject, validUntil, status, created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertDuplicateItemStmt = db.prepare(`
  INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertDuplicateAuditStmt = db.prepare(`
  INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const selectUserForDuplicateStmt = db.prepare(
  'SELECT name, username FROM users WHERE id = ?'
);

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

    const convert = db.transaction(() => {
      let userName = null;
      try {
          const u = db.prepare('SELECT name, username FROM users WHERE id = ?').get(userId) as { name?: string; username?: string } | undefined;
          if (u) {
              userName = u.name || u.username || null;
          }
      } catch (e) {}

      const number = getNextNumber('invoice');

      insertInvoiceStmt.run(
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
        insertItemStmt.run(
          crypto.randomUUID(),
          invoiceId,
          item.description,
          item.quantity,
          Math.round(item.unitPrice),
          Math.round(item.total)
        );
      }

      updateQuoteStatusStmt.run(QUOTE_STATUS.CONVERTI, quoteId);

      const logDetails = `Devis converti en facture: ${number}`;
      insertAuditLogStmt.run(crypto.randomUUID(), userId, userName || userId, 'CREATE', 'invoice', invoiceId, logDetails);

      return {
        invoiceId,
        invoiceNumber: number,
        quoteId
      };
    });

    return convert();
  },

  duplicateQuote(quoteId: string, userId: string, role: string): QuoteDuplicateResponse {
    // 1. Récupérer le devis source (soft-delete exclu)
    const quote = selectQuoteForDuplicateStmt.get(quoteId) as
      | (DbQuote & { created_by?: string; tpsAmount?: number })
      | undefined;

    if (!quote) {
      throw new QuoteServiceError('Quote not found', 404);
    }

    // 2. RBAC Règle métier : SEUL un opérateur (role='user') peut dupliquer un devis.
    //    Un admin supervise mais ne peut pas créer/dupliquer des documents opérationnels.
    if (role !== ROLES.USER) {
      throw new QuoteServiceError('Unauthorized: Only Users can duplicate quotes', 403);
    }

    // 3a. Un opérateur ne peut dupliquer que ses propres devis
    if (quote.created_by !== userId) {
      throw new QuoteServiceError(
        'Forbidden: You can only duplicate your own quotes',
        403
      );
    }

    // 3. Récupérer les lignes du devis source
    const items = selectQuoteItemsForDuplicateStmt.all(quoteId) as DbQuoteItem[];

    // 4. Récupérer le nom d'utilisateur hors transaction (évite un SELECT sous verrou)
    let userName: string | null = null;
    try {
      const u = selectUserForDuplicateStmt.get(userId) as
        | { name?: string; username?: string }
        | undefined;
      userName = u?.name || u?.username || null;
    } catch {
      // Non bloquant — l'audit log aura userId en fallback
    }

    const newId = crypto.randomUUID();

    // 5. Transaction atomique — tous les statements sont déjà compilés (module-level)
    const performDuplicate = db.transaction(() => {
      // getNextNumber gère : incrément, reset annuel, format DEV-001/CODE/YEAR
      const number = getNextNumber('quote');

      insertDuplicateQuoteStmt.run(
        newId,
        number,
        quote.clientId,
        quote.clientName,
        quote.clientEmail,
        new Date().toISOString().split('T')[0], // date = aujourd'hui
        quote.subtotal,
        quote.discount,
        quote.taxBase,
        quote.tvaAmount,
        quote.tpsAmount ?? 0,
        quote.cssAmount,
        quote.total,
        quote.notes ?? null,
        quote.subject ?? null,
        quote.validUntil ?? null,
        QUOTE_STATUS.EN_ATTENTE, // statut réinitialisé à brouillon
        userId
      );

      for (const item of items) {
        insertDuplicateItemStmt.run(
          crypto.randomUUID(),
          newId,
          item.description,
          item.quantity,
          item.unitPrice,
          item.total
        );
      }

      insertDuplicateAuditStmt.run(
        crypto.randomUUID(),
        userId,
        userName,
        'CREATE',
        'quote',
        newId,
        `Devis dupliqué depuis ${quoteId} → nouveau numéro: ${number}`
      );

      return { quoteId: newId, quoteNumber: number } satisfies QuoteDuplicateResponse;
    });

    return performDuplicate();
  }
};
