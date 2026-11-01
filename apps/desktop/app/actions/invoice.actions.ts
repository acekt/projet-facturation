"use server";

import { InvoiceService, InvoiceServiceError } from '@/lib/services/InvoiceService';
import { CreditNoteService } from '@/lib/services/CreditNoteService';
import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import { resolveActiveTenantId } from '@/lib/api/tenant';
import db from '@/lib/db';
import { InvoiceRepository } from '@/lib/repositories/InvoiceRepository';
import { invoiceSchema } from '@/lib/validations';
import crypto from 'crypto';
import { getNextNumber } from '@/lib/api/numbering';
import { assertLicenseAllowsCreation, LicenseRestrictedError } from '@/lib/api/license';
import { getErrorMessage } from '@/lib/utils/action-error';
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

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const invoices = InvoiceRepository.findAll(session.userId, session.role, activeTenantId);

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

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const invoice = InvoiceRepository.findById(id, session.userId, session.role, activeTenantId);
    if (!invoice) {
      const existsInTenant = InvoiceRepository.findById(id, undefined, undefined, activeTenantId);
      if (existsInTenant) return { success: false, error: 'Forbidden: You can only access your own invoices' };
      return { success: false, error: 'Invoice not found' };
    }

    const items = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(id) as DbInvoiceItem[];
    const payments = db.prepare('SELECT * FROM payments WHERE invoiceId = ? AND deletedAt IS NULL').all(id) as Array<{
        id: string;
        invoiceId: string;
        amount: number;
        paymentMethod: string;
        date: string;
        reference?: string;
        createdAt: string;
        deletedAt?: string;
    }>;

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
    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);

    // Contrôle de licence : bloquer la création si le tenant est en lecture seule
    try {
      assertLicenseAllowsCreation(activeTenantId);
    } catch (licErr: unknown) {
      if (licErr instanceof LicenseRestrictedError) {
        return { success: false, error: licErr.message };
      }
      throw licErr;
    }

    try {
      const result = InvoiceService.createInvoice(validData, session.userId, session.role, activeTenantId);
      logAudit('CREATE', 'invoice', result.id, `Nouvelle facture créée: ${result.number}`, session.userId, session.name || session.username || null, activeTenantId);
      return { success: true, data: result as unknown as InvoiceResponse };
    } catch (error: unknown) {
      if (error instanceof InvoiceServiceError) {
        return { success: false, error: error.message };
      }
      return { success: false, error: getErrorMessage(error, 'Échec de création de la facture') };
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

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const invoice = InvoiceRepository.findById(id, session.userId, session.role, activeTenantId);
    if (!invoice) {
      const existsInTenant = InvoiceRepository.findById(id, undefined, undefined, activeTenantId);
      if (existsInTenant) return { success: false, error: 'Forbidden: You can only delete your own invoices' };
      return { success: false, error: 'Invoice not found' };
    }

    const deleteTx = db.transaction(() => {
      const existingCN = db.prepare("SELECT id FROM credit_notes WHERE invoiceId = ? AND (deletedAt IS NULL OR deletedAt = '')").get(id);
      if (!existingCN) {
        const items = db.prepare("SELECT * FROM invoice_items WHERE invoiceId = ? AND (deletedAt IS NULL OR deletedAt = '')").all(id) as DbInvoiceItem[];
        if (items.length > 0) {
          CreditNoteService.createCreditNote(
            {
              invoiceId: invoice.id,
              reason: `Annulation de facture ${invoice.number}`,
              items: items.map((it) => ({
                description: it.description,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
              })),
            },
            session.userId,
            activeTenantId
          );
        }
      }

      const result = InvoiceRepository.softDelete(id, session.userId, session.role, activeTenantId);

      if (result.changes === 0) {
        return { success: false, error: 'Invoice not found or unauthorized' };
      }

      if (invoice.quoteId) {
        db.prepare("UPDATE quotes SET status = 'EN_ATTENTE' WHERE id = ?").run(invoice.quoteId);

        if (deleteQuote) {
          db.prepare("UPDATE quotes SET deletedAt = datetime('now') WHERE id = ?").run(invoice.quoteId);
        }
      }

      logAudit('DELETE', 'invoice', id, `Facture supprimée: ${invoice.number || id}`, session.userId, session.name || session.username || null, activeTenantId);

      return { success: true, data: true };
    });

    return deleteTx();
  } catch (error) {
    console.error('[Action deleteInvoice] Error:', error);
    return { success: false, error: 'Failed to delete invoice' };
  }
}
