"use server";

import { getSession } from '@/lib/api/auth';
import { syncWithCloud, type SyncReport } from '@/lib/sync/CloudSyncService';
import type { ActionResponse } from './client.actions';

/**
 * Lance un cycle de synchronisation (push + pull) avec Supabase.
 * Le JWT Supabase est fourni par le navigateur (session persistée du connecteur).
 * Réservé aux sessions Desktop valides (admin / opérateur).
 */
export async function runCloudSync(accessToken: string): Promise<ActionResponse<SyncReport>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Non authentifié' };
    if (!accessToken) return { success: false, error: 'Session Cloud absente' };

    const report = await syncWithCloud(accessToken);
    return { success: true, data: report };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Échec de la synchronisation' };
  }
}
