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
