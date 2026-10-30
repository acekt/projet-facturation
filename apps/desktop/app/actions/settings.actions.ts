"use server";

import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import { resolveActiveTenantId } from '@/lib/api/tenant';
import db from '@/lib/db';
import { SettingsRepository } from '@/lib/repositories/SettingsRepository';
import { settingsSchema } from '@/lib/validations';
import type { SettingsUpdateRequest, DbSettings } from '@/lib/types/api';
import type { ActionResponse } from './client.actions';
import { getErrorMessage } from '@/lib/utils/action-error';

export async function getSettings(): Promise<ActionResponse<DbSettings>> {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'user')) {
      return { success: false, error: 'Forbidden' };
    }

    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as DbSettings | undefined;
    if (!settings) {
      return { success: false, error: 'Settings not found' };
    }
    return { success: true, data: settings };
  } catch (error) {
    console.error('[Action getSettings] Error:', error);
    return { success: false, error: 'Failed to fetch settings' };
  }
}

export async function updateSettings(data: SettingsUpdateRequest): Promise<ActionResponse<DbSettings>> {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Forbidden' };
    }
    if (!session.userId) {
      return { success: false, error: 'User ID manquant dans la session' };
    }

    const validation = settingsSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const validData = validation.data;
    const fields = Object.keys(validData);

    try {
      const exists = db.prepare('SELECT id FROM settings WHERE id = 1').get();
      if (!exists) {
        SettingsRepository.upsertInitialSettings({
          ...validData,
          tenant_id: activeTenantId,
        });
      } else {
        const setClauses = fields.map((col) => `${col} = ?`).join(', ');
        const values = [...Object.values(validData), activeTenantId];
        const result = db.prepare(
          `UPDATE settings SET ${setClauses}, tenant_id = ? WHERE id = 1`
        ).run(...values);

        if (result.changes === 0) {
          return { success: false, error: "L'enregistrement n'a pas modifié la base de données." };
        }
      }
    } catch (dbError: unknown) {
      console.error('[Action updateSettings] Erreur SQLite:', dbError);
      return { success: false, error: "Erreur lors de l'enregistrement des paramètres.", details: getErrorMessage(dbError) };
    }

    logAudit('UPDATE', 'settings', '1', 'Paramètres mis à jour', session.userId, session.name || session.username || null, activeTenantId);

    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as DbSettings;
    return { success: true, data: settings };
  } catch (error: unknown) {
    console.error('[Action updateSettings] Erreur inattendue:', error);
    return { success: false, error: 'Erreur interne du serveur.', details: getErrorMessage(error) };
  }
}
