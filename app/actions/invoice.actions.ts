"use server";

import { InvoiceService, InvoiceServiceError } from '@/lib/services/InvoiceService';
import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import db from '@/lib/db';
import { InvoiceRepository } from '@/lib/repositories/InvoiceRepository';
import { invoiceSchema } from '@/lib/validations';
import crypto from 'crypto';
import { getNextNumber } from '@/lib/api/numbering';
import type {
  InvoiceResponse,
  InvoiceItem,
  PaymentResponse,
  InvoiceCreateRequest,
  DbInvoiceItem,
} from '@/lib/types/api';
import type { ActionResponse } from './client.actions';

export async function getInvoices(): Promise<ActionResponse<InvoiceResponse[]>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const invoices = InvoiceRepository.findAll(session.userId, session.role);

    const formattedInvoices: InvoiceResponse[] = invoices.map((i): InvoiceResponse => ({
      ...i,
      items: JSON.parse(i.items || '[]') as InvoiceItem[],
      payments: JSON.parse(i.payments || '[]') as PaymentResponse[],
    }));

    return { success: true, data: formattedInvoices };
  } catch (error) {
    console.error('[Action getInvoices] Error:', error);
    return { success: false, error: 'Failed to fetch invoices' };
  }
}

export async function getInvoiceById(id: string): Promise<ActionResponse<InvoiceResponse>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const invoice = InvoiceRepository.findById(id, session.userId, session.role);
    if (!invoice) {
      const exists = InvoiceRepository.findById(id);
      if (exists) return { success: false, error: 'Forbidden: You can only access your own invoices' };
      return { success: false, error: 'Invoice not found' };
    }

    const items = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(id) as DbInvoiceItem[];
    const payments = db.prepare('SELECT * FROM payments WHERE invoiceId = ? AND deletedAt IS NULL').all(id) as any[];

    const response: InvoiceResponse = {
      ...invoice,
      items: items.map((item): InvoiceItem => ({
        id: item.id,
        invoiceId: item.invoiceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      payments: payments.map((payment): PaymentResponse => ({
        id: payment.id,
        invoiceId: payment.invoiceId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        date: payment.date,
        reference: payment.reference,
        createdAt: payment.createdAt,
        deletedAt: payment.deletedAt,
      })),
    };

    return { success: true, data: response };
  } catch (error) {
    console.error('[Action getInvoiceById] Error:', error);
    return { success: false, error: 'Failed to fetch invoice' };
  }
}

export async function createInvoice(data: InvoiceCreateRequest): Promise<ActionResponse<InvoiceResponse>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };

    const validation = invoiceSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const validData = validation.data;

    try {
      const result = InvoiceService.createInvoice(validData, session.userId, session.role);
      logAudit('CREATE', 'invoice', result.id, `Nouvelle facture créée: ${result.number}`, session.userId, session.name || session.username || null);
      return { success: true, data: result as unknown as InvoiceResponse };
    } catch (error: any) {
      if (error instanceof InvoiceServiceError) {
        return { success: false, error: error.message };
      }
      throw error;
    }
  } catch (error) {
    console.error('[Action createInvoice] Error:', error);
    return { success: false, error: 'Failed to create invoice' };
  }
}

export async function deleteInvoice(id: string, deleteQuote: boolean = false): Promise<ActionResponse<boolean>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };

    const invoice = InvoiceRepository.findById(id, session.userId, session.role);
    if (!invoice) {
      const exists = InvoiceRepository.findById(id);
      if (exists) return { success: false, error: 'Forbidden: You can only delete your own invoices' };
      return { success: false, error: 'Invoice not found' };
    }

    const result = InvoiceRepository.softDelete(id, session.userId, session.role);

    if (result.changes === 0) {
      return { success: false, error: 'Invoice not found or unauthorized' };
    }

    if (invoice.quoteId) {
      db.prepare("UPDATE quotes SET status = 'EN_ATTENTE' WHERE id = ?").run(invoice.quoteId);

      if (deleteQuote) {
        db.prepare("UPDATE quotes SET deletedAt = datetime('now') WHERE id = ?").run(invoice.quoteId);
      }
    }

    const existingCN = db.prepare('SELECT id FROM credit_notes WHERE invoiceId = ? AND deletedAt IS NULL').get(id);
    if (!existingCN) {
      db.exec("INSERT OR IGNORE INTO sequences (name, current_value) VALUES ('credit_note', 0)");
      const cnId = crypto.randomUUID();
      const cnNumber = getNextNumber('credit_note');
      const items = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(id) as DbInvoiceItem[];

      db.transaction(() => {
        db.prepare(`
          INSERT INTO credit_notes (
            id, number, invoiceId, clientId, clientName, date, reason,
            subtotal, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          cnId, cnNumber, invoice.id, invoice.clientId, invoice.clientName,
          new Date().toISOString().split('T')[0],
          `Annulation de facture ${invoice.number}`,
          invoice.subtotal, invoice.taxBase, invoice.tvaAmount,
          invoice.tpsAmount ?? 0, invoice.cssAmount ?? 0,
          invoice.total, 'open', session.userId
        );

        const insertCNItem = db.prepare(`
          INSERT INTO credit_note_items (id, creditNoteId, description, quantity, unitPrice, total)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const item of items) {
          insertCNItem.run(crypto.randomUUID(), cnId, item.description, item.quantity, item.unitPrice, item.total);
        }
      })();
    }

    logAudit('DELETE', 'invoice', id, `Facture supprimée: ${invoice.number || id}`, session.userId, session.name || session.username || null);

    return { success: true, data: true };
  } catch (error) {
    console.error('[Action deleteInvoice] Error:', error);
    return { success: false, error: 'Failed to delete invoice' };
  }
}
