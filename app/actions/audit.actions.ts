"use server";

import db from '@/lib/db';
import { getSession } from '@/lib/api/auth';
import type { ActionResponse } from './client.actions';

export async function getAuditLogs(): Promise<ActionResponse<any[]>> {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT 100').all();
    return { success: true, data: logs };
  } catch (error) {
    console.error('[Action getAuditLogs] Error:', error);
    return { success: false, error: 'Failed to fetch logs' };
  }
}
