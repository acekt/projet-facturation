import db from '@/lib/db';
import { DbQuote } from '@/lib/types/api';
import { ROLES } from '@/lib/constants';
import { buildTenantFilter, resolveActiveTenantId } from '@/lib/api/tenant';

export const QuoteRepository = {
  findAll(userId: string, role: string, tenantId?: string | null): (DbQuote & { items: string })[] {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId, 'q');

    let sql = `
      SELECT q.*,
             (SELECT json_group_array(json_object(
               'id', id,
               'description', description,
               'quantity', quantity,
               'unitPrice', unitPrice,
               'total', total
             )) FROM quote_items WHERE quoteId = q.id AND (deletedAt IS NULL OR deletedAt = '')) as items
      FROM quotes q
      WHERE q.deletedAt IS NULL${tf.sql}
    `;
    const params: unknown[] = [...tf.params];

    if (role !== ROLES.ADMIN) {
      sql += ` AND q.created_by = ?`;
      params.push(userId);
    }

    sql += ` ORDER BY createdAt DESC`;

    const quotes = db.prepare(sql).all(...params) as (DbQuote & { items: string })[];
    
    // RÈGLE MÉTIER CRITIQUE : forcer le statut à EXPIRED si validUntil est dépassé
    const now = new Date();
    return quotes.map(quote => {
      if (quote.validUntil && quote.status !== 'CONVERTI' && new Date(quote.validUntil) < now) {
        return { ...quote, status: 'EXPIRED' };
      }
      return quote;
    });
  },

  findById(id: string, userId?: string, role?: string, tenantId?: string | null): (DbQuote & { created_by?: string }) | undefined {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);

    let sql = `SELECT * FROM quotes WHERE id = ? AND deletedAt IS NULL${tf.sql}`;
    const params: unknown[] = [id, ...tf.params];

    if (role && role !== ROLES.ADMIN && userId) {
      sql += ' AND created_by = ?';
      params.push(userId);
    }

    const quote = db.prepare(sql).get(...params) as (DbQuote & { created_by?: string }) | undefined;
    
    if (quote && quote.validUntil && quote.status !== 'CONVERTI' && new Date(quote.validUntil) < new Date()) {
      return { ...quote, status: 'EXPIRED' };
    }
    
    return quote;
  },

  findWithStatus(id: string, userId?: string, role?: string, tenantId?: string | null): (DbQuote & { created_by?: string }) | undefined {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);

    let sql = `SELECT status, deletedAt, created_by, number, tenant_id FROM quotes WHERE id = ?${tf.sql}`;
    const params: unknown[] = [id, ...tf.params];

    if (role && role !== ROLES.ADMIN && userId) {
      sql += ' AND created_by = ?';
      params.push(userId);
    }

    return db.prepare(sql).get(...params) as (DbQuote & { created_by?: string }) | undefined;
  },

  softDelete(id: string, userId?: string, role?: string, tenantId?: string | null): { changes: number } {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);

    let sql = `UPDATE quotes SET deletedAt = datetime('now') WHERE id = ?${tf.sql}`;
    const params: unknown[] = [id, ...tf.params];

    if (role && role !== ROLES.ADMIN && userId) {
      sql += ' AND created_by = ?';
      params.push(userId);
    }

    return db.prepare(sql).run(...params);
  },

  updateStatus(id: string, status: string, userId?: string, role?: string, tenantId?: string | null): { changes: number } {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);

    let sql = `UPDATE quotes SET status = ? WHERE id = ?${tf.sql}`;
    const params: unknown[] = [status, id, ...tf.params];

    if (role && role !== ROLES.ADMIN && userId) {
      sql += ' AND created_by = ?';
      params.push(userId);
    }

    return db.prepare(sql).run(...params);
  }
};
