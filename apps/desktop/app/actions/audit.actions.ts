"use server";

import db from '@/lib/db';
import { getSession } from '@/lib/api/auth';
import { buildTenantFilter, resolveActiveTenantId } from '@/lib/api/tenant';
import type { ActionResponse } from '@/lib/types/api';

export async function getAuditLogs(limit?: number): Promise<ActionResponse<any[]>> {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const tf = buildTenantFilter(activeTenantId, 'a');
    let sql = `
      SELECT a.*, COALESCE(NULLIF(trim(a.userName), ''), u.name, u.username, 'Système') as userName
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.userId
      WHERE 1=1${tf.sql}
      ORDER BY datetime(replace(a.createdAt, 'T', ' ')) DESC, a.rowid DESC
    `;
    const params: (string | number)[] = [...tf.params];
    if (typeof limit === 'number' && limit > 0) {
      sql += ' LIMIT ?';
      params.push(limit);
    } else {
      sql += ' LIMIT 50000';
    }
    const logs = db.prepare(sql).all(...params);
    return { success: true, data: logs };
  } catch (error) {
    console.error('[Action getAuditLogs] Error:', error);
    return { success: false, error: 'Failed to fetch logs' };
  }
}

export async function getPaginatedAuditLogs(
  page: number = 1,
  limit: number = 100,
  search: string = "",
  actionFilter: string = "ALL",
  entityFilter: string = "ALL",
  sortOrder: "desc" | "asc" = "desc"
): Promise<ActionResponse<{ logs: any[], totalCount: number }>> {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const tf = buildTenantFilter(activeTenantId, 'a');

    let baseSql = `FROM audit_logs a LEFT JOIN users u ON u.id = a.userId WHERE 1=1${tf.sql}`;
    const params: any[] = [...tf.params];

    if (search && search.trim() !== '') {
      baseSql += ` AND (a.action LIKE ? OR a.entityType LIKE ? OR a.details LIKE ? OR COALESCE(a.userName, u.name, u.username, '') LIKE ?)`;
      const likeQuery = `%${search.trim()}%`;
      params.push(likeQuery, likeQuery, likeQuery, likeQuery);
    }

    if (actionFilter && actionFilter !== 'ALL') {
      const act = actionFilter.toUpperCase();
      if (act === 'CREATE') {
        baseSql += ` AND (upper(a.action) = 'CREATE' OR upper(a.action) LIKE '%_CREATE')`;
      } else if (act === 'UPDATE') {
        baseSql += ` AND (upper(a.action) = 'UPDATE' OR upper(a.action) LIKE '%_UPDATE' OR upper(a.action) LIKE '%_CANCEL' OR upper(a.action) LIKE '%_CONVERT')`;
      } else if (act === 'DELETE') {
        baseSql += ` AND (upper(a.action) = 'DELETE' OR upper(a.action) LIKE '%_DELETE')`;
      } else if (act === 'SHARE') {
        baseSql += ` AND upper(a.action) = 'SHARE'`;
      } else if (act === 'LOGIN') {
        baseSql += ` AND (upper(a.action) = 'LOGIN' OR upper(a.action) = 'USER_LOGIN' OR upper(a.action) = 'LOGOUT' OR upper(a.action) = 'USER_LOGOUT')`;
      } else {
        baseSql += ` AND upper(a.action) = ?`;
        params.push(act);
      }
    }

    if (entityFilter && entityFilter !== 'ALL') {
      const ent = entityFilter.toLowerCase();
      if (ent === 'credit_note') {
        baseSql += ` AND lower(a.entityType) IN ('credit_note', 'creditnote')`;
      } else if (ent === 'ledger') {
        baseSql += ` AND lower(a.entityType) IN ('ledger', 'ledger_entry')`;
      } else if (ent === 'stock') {
        baseSql += ` AND lower(a.entityType) IN ('stock', 'stock_movement')`;
      } else if (ent === 'user') {
        baseSql += ` AND lower(a.entityType) IN ('user', 'auth')`;
      } else {
        baseSql += ` AND lower(a.entityType) = ?`;
        params.push(ent);
      }
    }

    const countRow = db.prepare(`SELECT COUNT(*) as count ${baseSql}`).get(...params) as { count: number };
    const totalCount = countRow.count;

    const offset = (page - 1) * limit;
    const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const logs = db.prepare(`
      SELECT a.*, COALESCE(NULLIF(trim(a.userName), ''), u.name, u.username, 'Système') as userName
      ${baseSql}
      ORDER BY datetime(replace(a.createdAt, 'T', ' ')) ${orderDir}, a.rowid ${orderDir}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return { success: true, data: { logs, totalCount } };
  } catch (error) {
    console.error('[Action getPaginatedAuditLogs] Error:', error);
    return { success: false, error: 'Failed to fetch logs' };
  }
}
