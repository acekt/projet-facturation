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

    // SQLite boolean params are easier as 1 or 0 but string params work for string IDs
    const query = `
      SELECT
        p.id as paymentId,
        i.id as invoiceId,
        i.number as invoiceNumber,
        i.total as invoiceTotal,
        p.amount,
        p.paymentMethod,
        p.date,
        p.reference
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE p.deletedAt IS NULL AND i.deletedAt IS NULL
        AND (i.clientId = ? OR i.clientName = ?)
        ${tf.sql}
      ORDER BY p.date DESC, p.createdAt DESC
    `;

    const params = [clientId, clientName, ...tf.params];
    const results = db.prepare(query).all(...params) as any[];

    // Calculate progressive balance
    // But doing it for all invoices mixed might be tricky, it's easier to do it per invoice
    // or chronologically if required. The prompt says: "le solde progressif ou restant de la facture."

    // Let's compute progressive balance per invoice.
    // To do this chronologically descending, we process ascending then reverse.
    const groupedByInvoice: Record<string, any[]> = {};
    for (const r of results) {
      if (!groupedByInvoice[r.invoiceId]) {
        groupedByInvoice[r.invoiceId] = [];
      }
      groupedByInvoice[r.invoiceId].push(r);
    }

    const finalResults: ClientPaymentHistoryRow[] = [];

    for (const invId in groupedByInvoice) {
      // Sort ascending to compute progressive
      const payments = groupedByInvoice[invId].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.paymentId.localeCompare(b.paymentId));
      let paidSoFar = 0;
      for (const p of payments) {
        paidSoFar += p.amount;
        p.progressiveBalance = Math.max(0, p.invoiceTotal - paidSoFar);
      }
      // Re-sort descending
      payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.paymentId.localeCompare(a.paymentId));
      finalResults.push(...payments);
    }

    // Sort all final results descending globally
    finalResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.paymentId.localeCompare(a.paymentId));

    return finalResults;
  },

  findPaymentsByInvoiceId(invoiceId: string, tenantId: string): InvoicePaymentHistoryRow[] {
    const tf = buildTenantFilter(tenantId, 'i');
    const query = `
      SELECT
        p.id,
        p.amount,
        p.paymentMethod,
        p.date,
        p.reference,
        i.total as invoiceTotal
      FROM payments p
      JOIN invoices i ON p.invoiceId = i.id
      WHERE p.invoiceId = ? AND p.deletedAt IS NULL AND i.deletedAt IS NULL
      ${tf.sql}
      ORDER BY p.date ASC, p.createdAt ASC
    `;

    const params = [invoiceId, ...tf.params];
    const results = db.prepare(query).all(...params) as any[];

    let progressivePaid = 0;
    return results.map(row => {
      progressivePaid += row.amount;
      const remainingAfterPayment = Math.max(0, row.invoiceTotal - progressivePaid);
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
