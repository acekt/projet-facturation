"use server";

import db from '@/lib/db';
import { getSession } from '@/lib/api/auth';
import type { ActionResponse } from './client.actions';
import { resolveActiveTenantId } from '@/lib/api/tenant';

/**
 * Enregistre une action de partage de document dans la table d'audit.
 */
export async function logDocumentShareAction(
  channel: "WhatsApp" | "Email",
  documentNumber: string,
  recipient: string
): Promise<ActionResponse<void>> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: 'Non autorisé' };
    }

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);

    db.prepare(`
      INSERT INTO audit_logs (id, userId, action, entity, entityId, details, createdAt, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      session.userId,
      "SHARE",
      "DOCUMENT",
      documentNumber,
      `Document ${documentNumber} partagé via ${channel} à ${recipient}`,
      new Date().toISOString(),
      activeTenantId
    );

    return { success: true, data: undefined };
  } catch (error) {
    console.error('[Action logDocumentShareAction] Error:', error);
    return { success: false, error: 'Échec de la journalisation' };
  }
}
