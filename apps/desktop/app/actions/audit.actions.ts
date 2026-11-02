"use server";

import db from '@/lib/db';
import { getSession } from '@/lib/api/auth';
import { buildTenantFilter, resolveActiveTenantId } from '@/lib/api/tenant';
import type { ActionResponse } from './client.actions';

export async function getAuditLogs(): Promise<ActionResponse<any[]>> {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const tf = buildTenantFilter(activeTenantId);
    const logs = db.prepare(`SELECT * FROM audit_logs WHERE 1=1${tf.sql} ORDER BY createdAt DESC LIMIT 100`).all(...tf.params);
    return { success: true, data: logs };
  } catch (error) {
    console.error('[Action getAuditLogs] Error:', error);
    return { success: false, error: 'Failed to fetch logs' };
  }
}

export async function getPaginatedAuditLogs(page: number = 1, limit: number = 100, search: string = ""): Promise<ActionResponse<{ logs: any[], totalCount: number }>> {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const tf = buildTenantFilter(activeTenantId);

    let baseSql = `FROM audit_logs WHERE 1=1${tf.sql}`;
    const params = [...tf.params];

    if (search && search.trim() !== '') {
      baseSql += ` AND (action LIKE ? OR entityType LIKE ? OR details LIKE ? OR userName LIKE ?)`;
      const likeQuery = `%${search.trim()}%`;
      params.push(likeQuery, likeQuery, likeQuery, likeQuery);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as count ${baseSql}`).get(...params) as { count: number };
    const totalCount = countRow.count;

    const offset = (page - 1) * limit;
    const logs = db.prepare(`SELECT * ${baseSql} ORDER BY createdAt DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

    return { success: true, data: { logs, totalCount } };
  } catch (error) {
    console.error('[Action getPaginatedAuditLogs] Error:', error);
    return { success: false, error: 'Failed to fetch logs' };
  }
}
