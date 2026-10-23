import db from '@/lib/db';
import { DbInvoice } from '@/lib/types/api';
import { ROLES, INVOICE_STATUS } from '@/lib/constants';
import { buildTenantFilter, resolveActiveTenantId } from '@/lib/api/tenant';

export const InvoiceRepository = {
  findAll(userId: string, role: string, tenantId?: string | null): (DbInvoice & { items: string; payments: string })[] {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId, 'i');

    let query = `
      SELECT i.id, i.number, i.quoteId, i.clientId, i.clientName, i.clientEmail, i.date, i.dueDate, i.subtotal, i.discount, i.taxBase, i.tvaAmount, i.tpsAmount, i.cssAmount, i.total, i.notes, i.subject, i.status, i.deletedAt, i.createdAt, i.created_by, i.tenant_id,
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
      WHERE i.deletedAt IS NULL${tf.sql}
    `;
    const params: unknown[] = [...tf.params];

    if (role !== ROLES.ADMIN) {
      query += ' AND i.created_by = ?';
      params.push(userId);
    }

    query += ' ORDER BY createdAt DESC';

    return db.prepare(query).all(...params) as (DbInvoice & { items: string; payments: string })[];
  },

  findById(id: string, userId?: string, role?: string, tenantId?: string | null): DbInvoice | undefined {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);

    let query = `SELECT * FROM invoices WHERE id = ? AND deletedAt IS NULL${tf.sql}`;
    const params: unknown[] = [id, ...tf.params];

    if (role && role !== ROLES.ADMIN && userId) {
      query += ' AND created_by = ?';
      params.push(userId);
    }

    return db.prepare(query).get(...params) as DbInvoice | undefined;
  },

  softDelete(id: string, userId?: string, role?: string, tenantId?: string | null): { changes: number } {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);

    let query = `UPDATE invoices SET deletedAt = datetime('now'), status = '${INVOICE_STATUS.CANCELLED}' WHERE id = ?${tf.sql}`;
    const params: unknown[] = [id, ...tf.params];

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
