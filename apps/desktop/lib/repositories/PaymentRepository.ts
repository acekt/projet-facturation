import db from '@/lib/db';
import { buildTenantFilter } from '@/lib/api/tenant';

export interface ClientPaymentHistoryRow {
  paymentId: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceTotal: number;
  amount: number;
  paymentMethod: string;
  date: string;
  reference: string | null;
  progressiveBalance: number;
}

export interface InvoicePaymentHistoryRow {
  id: string;
  amount: number;
  paymentMethod: string;
  date: string;
  reference: string | null;
  progressivePaid: number;
  remainingAfterPayment: number;
}

export const PaymentRepository = {
  findPaymentsByClientId(clientId: string, clientName: string, tenantId: string): ClientPaymentHistoryRow[] {
    const tf = buildTenantFilter(tenantId, 'i');
    const tfP = buildTenantFilter(tenantId, 'p');

    const query = `
      SELECT
        p.id as paymentId,
        i.id as invoiceId,
        i.number as invoiceNumber,
        i.total as invoiceTotal,
        COALESCE((
          SELECT SUM(cn.total)
          FROM credit_notes cn
          WHERE cn.invoiceId = i.id
            AND (cn.deletedAt IS NULL OR cn.deletedAt = '')
        ), 0) as totalCreditNotes,
        p.amount,
        p.paymentMethod,
        p.date,
        p.reference
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE p.deletedAt IS NULL AND i.deletedAt IS NULL
        AND (i.clientId = ? OR i.clientName = ?)
        ${tf.sql}
        ${tfP.sql}
      ORDER BY p.date DESC, p.createdAt DESC
    `;

    const params = [clientId, clientName, ...tf.params, ...tfP.params];
    const results = db.prepare(query).all(...params) as any[];

    const groupedByInvoice: Record<string, any[]> = {};
    for (const r of results) {
      if (!groupedByInvoice[r.invoiceId]) {
        groupedByInvoice[r.invoiceId] = [];
      }
      groupedByInvoice[r.invoiceId].push(r);
    }

    const finalResults: ClientPaymentHistoryRow[] = [];

    for (const invId in groupedByInvoice) {
      const payments = groupedByInvoice[invId].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.paymentId.localeCompare(b.paymentId));
      let paidSoFar = 0;
      for (const p of payments) {
        paidSoFar += p.amount;
        const netInvoiceTotal = Math.max(0, p.invoiceTotal - (p.totalCreditNotes || 0));
        p.progressiveBalance = Math.max(0, netInvoiceTotal - paidSoFar);
      }
      payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.paymentId.localeCompare(a.paymentId));
      finalResults.push(...payments);
    }

    finalResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.paymentId.localeCompare(a.paymentId));

    return finalResults;
  },

  findPaymentsByInvoiceId(invoiceId: string, tenantId: string): InvoicePaymentHistoryRow[] {
    const tf = buildTenantFilter(tenantId, 'i');
    const tfP = buildTenantFilter(tenantId, 'p');
    const query = `
      SELECT
        p.id,
        p.amount,
        p.paymentMethod,
        p.date,
        p.reference,
        i.total as invoiceTotal,
        COALESCE((
          SELECT SUM(cn.total)
          FROM credit_notes cn
          WHERE cn.invoiceId = i.id
            AND (cn.deletedAt IS NULL OR cn.deletedAt = '')
        ), 0) as totalCreditNotes
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE p.invoiceId = ? AND p.deletedAt IS NULL AND i.deletedAt IS NULL
      ${tf.sql}
      ${tfP.sql}
      ORDER BY p.date ASC, p.createdAt ASC
    `;

    const params = [invoiceId, ...tf.params, ...tfP.params];
    const results = db.prepare(query).all(...params) as any[];

    let progressivePaid = 0;
    return results.map(row => {
      progressivePaid += row.amount;
      const netInvoiceTotal = Math.max(0, row.invoiceTotal - (row.totalCreditNotes || 0));
      const remainingAfterPayment = Math.max(0, netInvoiceTotal - progressivePaid);
      return {
        id: row.id,
        amount: row.amount,
        paymentMethod: row.paymentMethod,
        date: row.date,
        reference: row.reference,
        progressivePaid,
        remainingAfterPayment
      };
    });
  }
};
