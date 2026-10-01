"use server";

import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import db from '@/lib/db';
import { QuoteRepository } from '@/lib/repositories/QuoteRepository';
import { quoteSchema, quoteConvertSchema } from '@/lib/validations';
import { getTaxRates } from '@/lib/api/invoice-logic';
import { computeTotals } from '@/lib/math-logic';
import crypto from 'crypto';
import { getNextNumber } from '@/lib/api/numbering';
import { validateQuoteStatusTransition } from '@/lib/api/quote-logic';
import { QuoteService, QuoteServiceError } from '@/lib/services/QuoteService';
import type { QuoteCreateRequest, QuoteResponse, QuoteItem, DbClient, DbQuoteItem } from '@/lib/types/api';
import type { ActionResponse } from './client.actions';

export async function getQuotes(): Promise<ActionResponse<QuoteResponse[]>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const quotes = QuoteRepository.findAll(session.userId, session.role);

    const formattedQuotes: QuoteResponse[] = quotes.map((q): QuoteResponse => ({
      ...q,
      deletedAt: q.deletedAt ?? undefined,
      items: JSON.parse(q.items || '[]') as QuoteItem[],
    }));

    return { success: true, data: formattedQuotes };
  } catch (error) {
    console.error('[Action getQuotes] Error:', error);
    return { success: false, error: 'Failed to fetch quotes' };
  }
}

export async function getQuoteById(id: string): Promise<ActionResponse<QuoteResponse>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const quote = QuoteRepository.findById(id, session.userId, session.role);
    if (!quote) {
      const exists = QuoteRepository.findById(id);
      if (exists) return { success: false, error: 'Forbidden: You can only access your own quotes' };
      return { success: false, error: 'Quote not found' };
    }

    const items = db.prepare('SELECT * FROM quote_items WHERE quoteId = ?').all(id) as DbQuoteItem[];

    const response: QuoteResponse = {
      ...quote,
      deletedAt: quote.deletedAt ?? undefined,
      items: items.map((item): QuoteItem => ({
        id: item.id,
        quoteId: item.quoteId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
    };

    return { success: true, data: response };
  } catch (error) {
    console.error('[Action getQuoteById] Error:', error);
    return { success: false, error: 'Failed to fetch quote' };
  }
}

export async function createQuote(data: QuoteCreateRequest): Promise<ActionResponse<{ id: string, number: string }>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId) as { role: string } | undefined;
    if (!user || (user.role !== 'user' && user.role !== 'admin')) {
      return { success: false, error: 'Unauthorized: You do not have permission to create quotes' };
    }

    const validation = quoteSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const validData = validation.data;

    const client = db.prepare('SELECT id FROM clients WHERE id = ? AND deletedAt IS NULL').get(validData.clientId) as DbClient | undefined;
    if (!client) {
      return { success: false, error: 'Client introuvable ou supprimé. Impossible de créer un devis pour ce client.' };
    }

    const rates = getTaxRates();
    const computed = computeTotals(validData.items, validData.discount, rates);
    const id = crypto.randomUUID();

    const insertQuoteTx = db.transaction((quoteItems: any[]) => {
      const number = getNextNumber('quote');

      db.prepare(`
        INSERT INTO quotes (
          id, number, clientId, clientName, clientEmail, date,
          subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount,
          total, notes, subject, validUntil, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, number, validData.clientId, validData.clientName, validData.clientEmail, validData.date,
        computed.subtotal, computed.discount, computed.taxBase, computed.tvaAmount, computed.tpsAmount, computed.cssAmount,
        computed.total, validData.notes ?? null, validData.subject ?? null, validData.validUntil ?? null, 'EN_ATTENTE', session.userId
      );

      const insertItemStmt = db.prepare(`INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total) VALUES (?, ?, ?, ?, ?, ?)`);
      for (const item of quoteItems) {
        insertItemStmt.run(crypto.randomUUID(), id, item.description, item.quantity, Math.round(item.unitPrice), Math.round(item.quantity * item.unitPrice));
      }

      logAudit('CREATE', 'quote', id, `Nouveau devis créé: ${number}`, session.userId, session.name || session.username || null);
      return { id, number };
    });

    const result = insertQuoteTx(validData.items);
    return { success: true, data: result };
  } catch (error) {
    console.error('[Action createQuote] Error:', error);
    return { success: false, error: 'Failed to create quote' };
  }
}

export async function updateQuote(id: string, data: QuoteCreateRequest): Promise<ActionResponse<{ id: string }>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };

    const existingQuote = QuoteRepository.findWithStatus(id, session.userId, session.role);
    if (!existingQuote || existingQuote.deletedAt !== null) {
      const exists = QuoteRepository.findWithStatus(id);
      if (exists && exists.deletedAt === null) return { success: false, error: 'Forbidden: You can only update your own quotes' };
      return { success: false, error: 'Quote not found' };
    }

    if (existingQuote.status === 'CONVERTI') {
      return { success: false, error: 'Impossible de modifier un devis déjà converti en facture.' };
    }

    const validation = quoteSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const validData = validation.data;
    const rates = getTaxRates();
    const computed = computeTotals(validData.items, validData.discount, rates);

    const updateQuoteTx = db.transaction((quoteItems: any[]) => {
      db.prepare(`
        UPDATE quotes
        SET clientId = ?, clientName = ?, clientEmail = ?, date = ?,
            subtotal = ?, discount = ?, taxBase = ?, tvaAmount = ?, tpsAmount = ?, cssAmount = ?,
            total = ?, notes = ?, subject = ?, validUntil = ?
        WHERE id = ?
      `).run(
        validData.clientId, validData.clientName, validData.clientEmail, validData.date,
        computed.subtotal, computed.discount, computed.taxBase, computed.tvaAmount, computed.tpsAmount, computed.cssAmount,
        computed.total, validData.notes ?? null, validData.subject ?? null, validData.validUntil ?? null, id
      );

      db.prepare('DELETE FROM quote_items WHERE quoteId = ?').run(id);

      const insertItemStmt = db.prepare(`INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total) VALUES (?, ?, ?, ?, ?, ?)`);
      for (const item of quoteItems) {
        insertItemStmt.run(crypto.randomUUID(), id, item.description, item.quantity, Math.round(item.unitPrice), Math.round(item.quantity * item.unitPrice));
      }

      logAudit('UPDATE', 'quote', id, `Devis modifié: ${id}`, session.userId, session.name || session.username || null);
      return { id };
    });

    const result = updateQuoteTx(validData.items);
    return { success: true, data: result };
  } catch (error) {
    console.error('[Action updateQuote] Error:', error);
    return { success: false, error: 'Failed to update quote' };
  }
}

export async function deleteQuote(id: string): Promise<ActionResponse<boolean>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };

    const quote = QuoteRepository.findWithStatus(id, session.userId, session.role);
    if (!quote || quote.deletedAt !== null) {
      const exists = QuoteRepository.findWithStatus(id);
      if (exists && exists.deletedAt === null) return { success: false, error: 'Forbidden: You can only delete your own quotes' };
      return { success: false, error: 'Quote not found' };
    }

    if (quote.status === 'CONVERTI') {
      return { success: false, error: 'Impossible de supprimer un devis déjà converti en facture.' };
    }

    QuoteRepository.softDelete(id, session.userId, session.role);
    logAudit('DELETE', 'quote', id, `Devis supprimé: ${quote.number || id}`, session.userId, session.name || session.username || null);
    
    return { success: true, data: true };
  } catch (error) {
    console.error('[Action deleteQuote] Error:', error);
    return { success: false, error: 'Failed to delete quote' };
  }
}

export async function updateQuoteStatus(id: string, status: string): Promise<ActionResponse<{ status: string }>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId) as { role: string } | undefined;
    if (!user) return { success: false, error: 'Unauthorized' };

    const quote = QuoteRepository.findWithStatus(id, session.userId, session.role);
    if (!quote || quote.deletedAt !== null) {
      const exists = QuoteRepository.findWithStatus(id);
      if (exists && exists.deletedAt === null) return { success: false, error: 'Forbidden: You can only update your own quotes' };
      return { success: false, error: 'Quote not found' };
    }

    if (!status) return { success: false, error: 'Statut requis' };

    if (!validateQuoteStatusTransition(quote.status, status)) {
      return { success: false, error: `Transition de statut impossible : de ${quote.status} à ${status}` };
    }

    QuoteRepository.updateStatus(id, status, session.userId, session.role);
    logAudit('UPDATE', 'quote', id, `Changement de statut devis: ${quote.status} -> ${status}`, session.userId, session.name || session.username || null);

    return { success: true, data: { status } };
  } catch (error) {
    console.error('[Action updateQuoteStatus] Error:', error);
    return { success: false, error: 'Failed to update quote status' };
  }
}

export async function convertQuoteToInvoice(quoteId: string): Promise<ActionResponse<import('@/lib/types/api').QuoteConvertResponse>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId) as { role: string } | undefined;
    if (!user || (user.role !== 'user' && user.role !== 'admin')) return { success: false, error: 'Unauthorized: Only Users and Admins can convert quotes' };

    const validation = quoteConvertSchema.safeParse({ quoteId });
    if (!validation.success) {
      return { success: false, error: 'Invalid request payload' };
    }

    try {
      const response = QuoteService.convertToInvoice(quoteId, session.userId, session.role);
      return { success: true, data: response };
    } catch (error: any) {
      if (error instanceof QuoteServiceError) {
        return { success: false, error: error.message };
      }
      throw error;
    }
  } catch (error) {
    console.error('[Action convertQuoteToInvoice] Error:', error);
    return { success: false, error: 'Failed to convert quote to invoice' };
  }
}
