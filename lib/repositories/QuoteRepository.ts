import db from '@/lib/db';
import { DbQuote, QuoteItem } from '@/lib/types/api';
import { ROLES } from '@/lib/constants';

export const QuoteRepository = {
  findAll(userId: string, role: string): (DbQuote & { items: string })[] {
    let sql = `
      SELECT q.*,
             (SELECT json_group_array(json_object(
               'id', id,
               'description', description,
               'quantity', quantity,
               'unitPrice', unitPrice,
               'total', total
             )) FROM quote_items WHERE quoteId = q.id) as items
      FROM quotes q
      WHERE q.deletedAt IS NULL
    `;
    const params: unknown[] = [];

    if (role !== ROLES.ADMIN) {
      sql += ` AND q.created_by = ?`;
      params.push(userId);
    }

    sql += ` ORDER BY createdAt DESC`;

    return db.prepare(sql).all(...params) as (DbQuote & { items: string })[];
  },

  findById(id: string): (DbQuote & { created_by?: string }) | undefined {
    return db.prepare('SELECT * FROM quotes WHERE id = ? AND deletedAt IS NULL').get(id) as (DbQuote & { created_by?: string }) | undefined;
  },

  findWithStatus(id: string): (DbQuote & { created_by?: string }) | undefined {
    return db.prepare('SELECT status, deletedAt, created_by FROM quotes WHERE id = ?').get(id) as (DbQuote & { created_by?: string }) | undefined;
  },

  softDelete(id: string): void {
    db.prepare("UPDATE quotes SET deletedAt = datetime('now') WHERE id = ?").run(id);
  },

  updateStatus(id: string, status: string): void {
    db.prepare('UPDATE quotes SET status = ? WHERE id = ?').run(status, id);
  }
};
