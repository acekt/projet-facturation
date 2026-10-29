"use server";

import { getActiveAnnouncements, isFlagEnabled, type HubAnnouncement } from '@/lib/api/hub-cache';

export async function getDesktopAnnouncementsAction(): Promise<{ success: boolean; data: HubAnnouncement[] }> {
  try {
    const announcements = getActiveAnnouncements();
    return { success: true, data: announcements };
  } catch (error) {
    console.error('[getDesktopAnnouncementsAction] Erreur:', error);
    return { success: false, data: [] };
  }
}

export async function checkFeatureFlagAction(flagKey: string): Promise<{ success: boolean; enabled: boolean }> {
  try {
    const enabled = isFlagEnabled(flagKey);
    return { success: true, enabled };
  } catch {
    return { success: false, enabled: false };
  }
}
