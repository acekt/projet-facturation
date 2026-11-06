"use server";

import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import { buildTenantFilter, resolveActiveTenantId } from '@/lib/api/tenant';
import db from '@/lib/db';
import crypto from 'crypto';
import { paymentCreateSchema } from '@/lib/validations';
import { updateInvoiceStatus } from '@/lib/api/invoice-logic';
import type { PaymentCreateRequest, PaymentResponse, DbPayment } from '@/lib/types/api';
import type { ActionResponse } from './client.actions';
import { LedgerRepository } from '@/lib/repositories/LedgerRepository';
import { PaymentRepository, ClientPaymentHistoryRow, InvoicePaymentHistoryRow } from '@/lib/repositories/PaymentRepository';

export async function getPayments(): Promise<ActionResponse<PaymentResponse[]>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    if (!activeTenantId) return { success: false, error: 'Tenant introuvable' };
    const tf = buildTenantFilter(activeTenantId);
    let query = `SELECT id, invoiceId, amount, paymentMethod, date, reference, createdAt, deletedAt, created_by FROM payments WHERE deletedAt IS NULL${tf.sql}`;
    const params: unknown[] = [...tf.params];
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

export async function createPayment(data: PaymentCreateRequest): Promise<ActionResponse<{ id: string, newStatus: string, reference?: string }>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };
    if (session.role !== 'admin' && session.role !== 'user') return { success: false, error: 'Unauthorized: Only Users can record payments' };

    const validation = paymentCreateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const { invoiceId, amount, paymentMethod, date, reference } = validation.data;
    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    if (!activeTenantId) return { success: false, error: 'Tenant introuvable' };
    const tf = buildTenantFilter(activeTenantId);

    const checkInvoiceStmt = db.prepare(`
      SELECT i.number, i.total, i.created_by, c.name as clientName
      FROM invoices i
      LEFT JOIN clients c ON i.clientId = c.id
      WHERE i.id = ? AND i.deletedAt IS NULL${tf.sql.replace(/tenant_id/g, 'i.tenant_id')}
    `);
    const invoice = checkInvoiceStmt.get(invoiceId, ...tf.params) as { number?: string; total: number; created_by?: string; clientName?: string } | undefined;
    
    if (!invoice) return { success: false, error: 'Facture introuvable ou supprimée' };
    if (session.role !== 'admin' && invoice.created_by !== session.userId) {
      return { success: false, error: 'Forbidden: You can only record payments for your own invoices' };
    }

    const checkTotalPaidStmt = db.prepare(`SELECT COALESCE(SUM(amount), 0) as totalPaid FROM payments WHERE invoiceId = ? AND deletedAt IS NULL${tf.sql}`);
    const paidResult = checkTotalPaidStmt.get(invoiceId, ...tf.params) as { totalPaid: number };
    const totalPaid = Math.round(paidResult.totalPaid || 0);
    const totalTTC = Math.round(invoice.total);
    const remaining = totalTTC - totalPaid;

    if (Math.round(amount) > remaining) {
      const formattedAmt = new Intl.NumberFormat('fr-FR').format(Math.round(amount));
      const formattedRem = new Intl.NumberFormat('fr-FR').format(Math.round(remaining));
      return { success: false, error: `Le montant du paiement (${formattedAmt} FCFA) excède le reste à charge de la facture (${formattedRem} FCFA)` };
    }

    const id = crypto.randomUUID();
    const resolvedReference =
      reference && reference.trim() !== ''
        ? reference.trim()
        : `REG-${(date || new Date().toISOString().slice(0, 10)).slice(0, 10).replace(/-/g, '')}-${String(Math.floor(1000 + Math.random() * 9000))}`;

    const insertPayment = db.transaction(() => {
      db.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, created_by, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, invoiceId, Math.round(amount), paymentMethod, date, resolvedReference, session.userId, activeTenantId);

      const newStatus = updateInvoiceStatus(invoiceId, activeTenantId);

      // Auto-sync with ledger
      LedgerRepository.create({
        tenant_id: activeTenantId,
        date,
        type: 'IN',
        category: 'Ventes & Facturation',
        description: `Paiement reçu pour facture ${invoice.number || invoiceId}`,
        amount: Math.round(amount),
        paymentMethod,
        reference: resolvedReference,
        counterparty: invoice.clientName || 'Client inconnu',
        linkedInvoiceId: invoiceId,
        linkedPaymentId: id,
        created_by: session.userId,
      });

      const formattedAmt = new Intl.NumberFormat('fr-FR').format(Math.round(amount));
      logAudit('CREATE', 'payment', id, `Paiement enregistré: ${formattedAmt} FCFA sur facture ${invoice.number || invoiceId} (${resolvedReference})`, session.userId, session.name || session.username || null, activeTenantId);
      return { id, newStatus, reference: resolvedReference };
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

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    if (!activeTenantId) return { success: false, error: 'Tenant introuvable' };
    const tf = buildTenantFilter(activeTenantId);
    const payment = db.prepare(`SELECT invoiceId FROM payments WHERE id = ? AND deletedAt IS NULL${tf.sql}`).get(id, ...tf.params) as DbPayment | undefined;
    if (!payment) return { success: false, error: 'Payment not found' };

    const deleteResult = db.transaction(() => {
      db.prepare(`UPDATE payments SET deletedAt = datetime('now') WHERE id = ?${tf.sql}`).run(id, ...tf.params);

      // Sync deletion with ledger
      db.prepare(`UPDATE ledger_entries SET deletedAt = datetime('now') WHERE linkedPaymentId = ? AND tenant_id = ?`).run(id, activeTenantId);

      const inv = db.prepare('SELECT number FROM invoices WHERE id = ?').get(payment.invoiceId) as { number?: string } | undefined;
      logAudit('DELETE', 'payment', id, `Paiement supprimé pour facture ${inv?.number || payment.invoiceId}`, session.userId, session.name || session.username || null, activeTenantId);

      const newStatus = updateInvoiceStatus(payment.invoiceId, activeTenantId);
      return { success: true, newStatus };
    })();

    return { success: true, data: deleteResult };
  } catch (error) {
    console.error('[Action deletePayment] Error:', error);
    return { success: false, error: 'Failed to delete payment' };
  }
}

export async function getClientPaymentHistory(clientId: string, clientName?: string): Promise<ActionResponse<ClientPaymentHistoryRow[]>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId || null);

    // In our repository we check by both id and name for completeness
    const history = PaymentRepository.findPaymentsByClientId(clientId, clientName || '', activeTenantId || "");

    return { success: true, data: history };
  } catch (error) {
    console.error('[Action getClientPaymentHistory] Error:', error);
    return { success: false, error: 'Failed to fetch client payment history' };
  }
}

export async function getInvoicePaymentHistory(invoiceId: string): Promise<ActionResponse<InvoicePaymentHistoryRow[]>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId || null);
    const history = PaymentRepository.findPaymentsByInvoiceId(invoiceId, activeTenantId || "");

    return { success: true, data: history };
  } catch (error) {
    console.error('[Action getInvoicePaymentHistory] Error:', error);
    return { success: false, error: 'Failed to fetch invoice payment history' };
  }
}
