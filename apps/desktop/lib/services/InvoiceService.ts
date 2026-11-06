import db from '@/lib/db';
import crypto from 'crypto';
import { getNextNumber } from '@/lib/api/numbering';
import { DbClient } from '@/lib/types/api';
import { ROLES, QUOTE_STATUS, INVOICE_STATUS } from '@/lib/constants';
import { getTaxRates } from '@/lib/api/invoice-logic';
import { computeTotals } from '@/lib/math-logic';
import { buildTenantFilter, resolveActiveTenantId } from '@/lib/api/tenant';
import { StockRepository } from '@/lib/repositories/StockRepository';

export class InvoiceServiceError extends Error {
  constructor(public message: string, public status: number) {
    super(message);
  }
}

export function resolveValidLocalUserId(dbInstance: any, userId?: string | null): string | null {
  if (!userId) return null;
  const exists = dbInstance.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (exists) return userId;
  const fallbackAdmin = dbInstance.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as { id: string } | undefined;
  return fallbackAdmin?.id ?? null;
}

export function resolveValidServiceId(dbInstance: any, rawServiceId?: string | null): string | null {
  if (!rawServiceId || typeof rawServiceId !== 'string' || rawServiceId.trim() === '') {
    return null;
  }
  const cleanId = rawServiceId.trim();
  const exists = dbInstance.prepare('SELECT id FROM services WHERE id = ?').get(cleanId);
  return exists ? cleanId : null;
}

export const InvoiceService = {
  createInvoice(data: any, userId: string, role: string, tenantId?: string | null) {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);

    // Validate client
    const client = db
      .prepare(`SELECT id FROM clients WHERE id = ? AND deletedAt IS NULL${tf.sql}`)
      .get(data.clientId, ...tf.params) as DbClient | undefined;
    if (!client) {
      throw new InvoiceServiceError('Client introuvable ou supprimé. Impossible de créer une facture pour ce client.', 400);
    }

    let quoteSubject: string | null = null;
    if (data.quoteId) {
      const quote = db
        .prepare(`SELECT status, deletedAt, created_by, validUntil, subject FROM quotes WHERE id = ?${tf.sql}`)
        .get(data.quoteId, ...tf.params) as { status: string; deletedAt: string | null; created_by?: string; validUntil?: string; subject?: string } | undefined;

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
      if (quote.validUntil && new Date() > new Date(quote.validUntil)) {
        throw new InvoiceServiceError('Impossible de convertir : ce devis a expiré.', 400);
      }
      quoteSubject = quote.subject ?? null;
    }

    const baseRates = getTaxRates();
    const rates = {
      cssRate: data.applyCss === false ? 0 : (data.applyCss === true ? (baseRates.cssRate || 1) : baseRates.cssRate),
      tpsRate: data.applyTps === false ? 0 : (data.applyTps === true ? (baseRates.tpsRate || 9.5) : baseRates.tpsRate),
      tvaRate: data.applyTva === false ? 0 : (data.applyTva === true ? (baseRates.tvaRate || 18) : baseRates.tvaRate),
    };
    const computed = computeTotals(data.items, data.discount, rates);

    const id = crypto.randomUUID();
    const dueDate =
      data.dueDate ||
      (() => {
        const d = new Date(data.date || Date.now());
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
      })();

    const insertInvoice = db.transaction(() => {
      const number = getNextNumber('invoice');

      db.prepare(`
        INSERT INTO invoices (
          id, number, quoteId, clientId, clientName, clientEmail, date, dueDate,
          subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, notes, subject, created_by, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        number,
        data.quoteId ?? null,
        data.clientId,
        data.clientName,
        data.clientEmail && typeof data.clientEmail === 'string' && data.clientEmail.trim() !== '' ? data.clientEmail.trim() : null,
        data.date,
        dueDate,
        computed.subtotal,
        computed.discount,
        computed.taxBase,
        computed.tvaAmount,
        computed.tpsAmount,
        computed.cssAmount,
        computed.total,
        data.status === 'DRAFT' || data.status === 'BROUILLON' || data.status === 'draft' ? 'draft' : INVOICE_STATUS.UNPAID,
        data.notes ?? null,
        data.subject ?? quoteSubject,
        resolveValidLocalUserId(db, userId) || userId,
        activeTenantId
      );

      const insertItem = db.prepare(`
        INSERT INTO invoice_items (id, invoiceId, serviceId, description, quantity, unitPrice, total, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const isDraft = data.status === 'DRAFT' || data.status === 'BROUILLON' || data.status === 'draft';
      const resolvedUserId = resolveValidLocalUserId(db, userId) || userId;

      for (const item of data.items) {
        const rawSvcId = item.serviceId || null;
        const svcId = resolveValidServiceId(db, rawSvcId);
        insertItem.run(
          crypto.randomUUID(),
          id,
          svcId,
          item.description,
          item.quantity,
          Math.round(item.unitPrice),
          Math.round(item.quantity * item.unitPrice),
          activeTenantId
        );

        if (svcId && !isDraft) {
          try {
             StockRepository.recordStockMovement({
               serviceId: svcId,
               type: 'INVOICE_DEDUCTION',
               quantity: item.quantity,
               referenceDoc: number,
             }, resolvedUserId, activeTenantId);
          } catch (e) {
             // Ignore if it's not a valid service or doesn't track stock
          }
        }
      }

      if (data.quoteId) {
        db.prepare(`UPDATE quotes SET status = '${QUOTE_STATUS.CONVERTI}' WHERE id = ?`).run(data.quoteId);
      }

      return { id, number };
    });

    return insertInvoice();
  }
};
