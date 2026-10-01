"use server";

import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import db from '@/lib/db';
import crypto from 'crypto';
import { paymentCreateSchema } from '@/lib/validations';
import { updateInvoiceStatus } from '@/lib/api/invoice-logic';
import type { PaymentCreateRequest, PaymentResponse, DbPayment } from '@/lib/types/api';
import type { ActionResponse } from './client.actions';

export async function getPayments(): Promise<ActionResponse<PaymentResponse[]>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    let query = 'SELECT id, invoiceId, amount, paymentMethod, date, reference, createdAt, deletedAt, created_by FROM payments WHERE deletedAt IS NULL';
    const params: unknown[] = [];
    if (session.role !== 'admin') {
      query += ' AND created_by = ?';
      params.push(session.userId);
    }
    query += ' ORDER BY createdAt DESC';

    const payments = db.prepare(query).all(...params) as DbPayment[];
    const paymentResponses: PaymentResponse[] = payments.map((payment): PaymentResponse => ({
      id: payment.id,
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      date: payment.date,
      reference: payment.reference,
      createdAt: payment.createdAt,
      deletedAt: payment.deletedAt,
      created_by: payment.created_by,
    }));

    return { success: true, data: paymentResponses };
  } catch (error) {
    console.error('[Action getPayments] Error:', error);
    return { success: false, error: 'Failed to fetch payments' };
  }
}

export async function createPayment(data: PaymentCreateRequest): Promise<ActionResponse<{ id: string, newStatus: string }>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };
    if (session.role !== 'admin' && session.role !== 'user') return { success: false, error: 'Unauthorized: Only Users can record payments' };

    const validation = paymentCreateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const { invoiceId, amount, paymentMethod, date, reference } = validation.data;

    const checkInvoiceStmt = db.prepare('SELECT total, created_by FROM invoices WHERE id = ? AND deletedAt IS NULL');
    const invoice = checkInvoiceStmt.get(invoiceId) as { total: number; created_by?: string } | undefined;
    
    if (!invoice) return { success: false, error: 'Facture introuvable ou supprimée' };
    if (session.role !== 'admin' && invoice.created_by !== session.userId) {
      return { success: false, error: 'Forbidden: You can only record payments for your own invoices' };
    }

    const checkTotalPaidStmt = db.prepare('SELECT COALESCE(SUM(amount), 0) as totalPaid FROM payments WHERE invoiceId = ? AND deletedAt IS NULL');
    const paidResult = checkTotalPaidStmt.get(invoiceId) as { totalPaid: number };
    const totalPaid = Math.round(paidResult.totalPaid || 0);
    const totalTTC = Math.round(invoice.total);
    const remaining = totalTTC - totalPaid;

    if (Math.round(amount) > remaining) {
      return { success: false, error: `Le montant du paiement (${amount} XAF) excède le reste à charge de la facture (${remaining} XAF)` };
    }

    const id = crypto.randomUUID();

    const insertPayment = db.transaction(() => {
      db.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, invoiceId, Math.round(amount), paymentMethod, date, reference || null, session.userId);

      const newStatus = updateInvoiceStatus(invoiceId);
      logAudit('CREATE', 'payment', id, `Paiement enregistré: ${amount} XAF sur facture ${invoiceId}`, session.userId, session.name || session.username || null);
      return { id, newStatus };
    });

    const result = insertPayment();
    return { success: true, data: result };
  } catch (error) {
    console.error('[Action createPayment] Error:', error);
    return { success: false, error: 'Failed to record payment' };
  }
}

export async function deletePayment(id: string): Promise<ActionResponse<{ success: boolean, newStatus: string }>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };
    if (session.role !== 'admin') return { success: false, error: 'Forbidden: Only Admin can delete payments' };

    const payment = db.prepare('SELECT invoiceId FROM payments WHERE id = ? AND deletedAt IS NULL').get(id) as DbPayment | undefined;
    if (!payment) return { success: false, error: 'Payment not found' };

    const deleteResult = db.transaction(() => {
      db.prepare("UPDATE payments SET deletedAt = datetime('now') WHERE id = ?").run(id);
      logAudit('DELETE', 'payment', id, `Paiement supprimé pour facture ${payment.invoiceId}`, session.userId, session.name || session.username || null);

      const newStatus = updateInvoiceStatus(payment.invoiceId);
      return { success: true, newStatus };
    })();

    return { success: true, data: deleteResult };
  } catch (error) {
    console.error('[Action deletePayment] Error:', error);
    return { success: false, error: 'Failed to delete payment' };
  }
}
