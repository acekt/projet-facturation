"use server";

import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import db from '@/lib/db';
import { settingsSchema } from '@/lib/validations';
import type { SettingsUpdateRequest, DbSettings } from '@/lib/types/api';
import type { ActionResponse } from './client.actions';

export async function getSettings(): Promise<ActionResponse<DbSettings>> {
  try {
    const session = await getSession();
    if (!session) {
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

    const validData = validation.data;
    const fields = Object.keys(validData);
    const columns = ['id', ...fields].join(', ');
    const placeholders = ['1', ...fields.map(() => '?')].join(', ');
    const values = Object.values(validData);

    try {
      const result = db.prepare(
        `INSERT OR REPLACE INTO settings (${columns}) VALUES (${placeholders})`
      ).run(...values);

      if (result.changes === 0) {
        return { success: false, error: "L'enregistrement n'a pas modifié la base de données." };
      }
    } catch (dbError: any) {
      console.error('[Action updateSettings] Erreur SQLite:', dbError);
      return { success: false, error: "Erreur lors de l'enregistrement des paramètres.", details: dbError?.message ?? String(dbError) };
    }

    logAudit('UPDATE', 'settings', '1', 'Paramètres mis à jour', session.userId, session.name || session.username || null);

    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as DbSettings;
    return { success: true, data: settings };
  } catch (error: any) {
    console.error('[Action updateSettings] Erreur inattendue:', error);
    return { success: false, error: 'Erreur interne du serveur.', details: error?.message };
  }
}
