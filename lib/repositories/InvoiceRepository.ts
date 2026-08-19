import db from '@/lib/db';
import { DbInvoice, InvoiceItem, PaymentResponse } from '@/lib/types/api';
import { ROLES, INVOICE_STATUS } from '@/lib/constants';

export const InvoiceRepository = {
  findAll(userId: string, role: string): (DbInvoice & { items: string; payments: string })[] {
    let query = `
      SELECT i.*,
             (SELECT json_group_array(json_object(
               'id', id,
               'description', description,
               'quantity', quantity,
               'unitPrice', unitPrice,
               'total', total
             )) FROM invoice_items WHERE invoiceId = i.id) as items,
             (SELECT json_group_array(json_object(
               'id', id,
               'amount', amount,
               'paymentMethod', paymentMethod,
               'date', date
             )) FROM payments WHERE invoiceId = i.id AND deletedAt IS NULL) as payments
      FROM invoices i
      WHERE i.deletedAt IS NULL
    `;
    const params: unknown[] = [];

    if (role !== ROLES.ADMIN) {
      query += ' AND i.created_by = ?';
      params.push(userId);
    }

    query += ' ORDER BY createdAt DESC';

    return db.prepare(query).all(...params) as (DbInvoice & { items: string; payments: string })[];
  },

  findById(id: string, userId?: string, role?: string): DbInvoice | undefined {
    let query = 'SELECT * FROM invoices WHERE id = ? AND deletedAt IS NULL';
    const params: unknown[] = [id];

    if (role && role !== ROLES.ADMIN && userId) {
      query += ' AND created_by = ?';
      params.push(userId);
    }

    return db.prepare(query).get(...params) as DbInvoice | undefined;
  },

  softDelete(id: string, userId?: string, role?: string): { changes: number } {
    let query = `UPDATE invoices SET deletedAt = datetime('now'), status = '${INVOICE_STATUS.CANCELLED}' WHERE id = ?`;
    const params: unknown[] = [id];

    if (role && role !== ROLES.ADMIN && userId) {
      query += ' AND created_by = ?';
      params.push(userId);
    }

    return db.prepare(query).run(...params);
  },

  updateQuoteStatus(quoteId: string, status: string): void {
    db.prepare(`UPDATE quotes SET status = ? WHERE id = ?`).run(status, quoteId);
  }
};
