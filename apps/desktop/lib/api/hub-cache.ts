import db from '@/lib/db';

export interface HubAnnouncement {
  id: string;
  title: string;
  body: string;
  level: 'info' | 'warning' | 'maintenance' | 'critical';
  is_active: boolean;
  starts_at: string;
  ends_at?: string | null;
  target_tenant_id?: string | null;
  created_at: string;
}

export interface HubTenantFlag {
  tenant_id: string;
  flag_key: string;
  enabled: boolean;
  config: Record<string, unknown>;
  updated_at: string;
}

/**
 * Sauvegarde une entrée dans le cache local Hub (annonces, flags, etc.)
 */
export function saveHubCache(kind: string, key: string, payload: unknown): void {
  try {
    const json = JSON.stringify(payload);
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO hub_cache (kind, key, payload, fetched_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(kind, key) DO UPDATE SET
        payload = excluded.payload,
        fetched_at = excluded.fetched_at
    `).run(kind, key, json, nowIso);
  } catch (err) {
    console.warn(`[hub-cache] Échec écriture cache (${kind}/${key}):`, err);
  }
}

/**
 * Récupère une entrée du cache local Hub
 */
export function getHubCache<T>(kind: string, key: string): T | null {
  try {
    const row = db.prepare('SELECT payload FROM hub_cache WHERE kind = ? AND key = ?').get(kind, key) as { payload?: string } | undefined;
    if (!row?.payload) return null;
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

/**
 * Récupère toutes les entrées d'un type donné
 */
export function getAllHubCache<T>(kind: string): Array<{ key: string; payload: T; fetched_at: string }> {
  try {
    const rows = db.prepare('SELECT key, payload, fetched_at FROM hub_cache WHERE kind = ? ORDER BY fetched_at DESC').all(kind) as Array<{
      key: string;
      payload: string;
      fetched_at: string;
    }>;
    return rows.map((r) => ({
      key: r.key,
      payload: JSON.parse(r.payload) as T,
      fetched_at: r.fetched_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Vérifie si un drapeau de fonctionnalité (feature flag) est activé pour ce tenant
 */
export function isFlagEnabled(flagKey: string, defaultVal: boolean = false): boolean {
  try {
    const flag = getHubCache<HubTenantFlag>('flag', flagKey);
    if (!flag) return defaultVal;
    return Boolean(flag.enabled);
  } catch {
    return defaultVal;
  }
}

/**
 * Récupère les annonces actives et non expirées
 */
export function getActiveAnnouncements(): HubAnnouncement[] {
  try {
    const nowIso = new Date().toISOString();
    const cached = getAllHubCache<HubAnnouncement>('announcement');
    return cached
      .map((c) => c.payload)
      .filter((a) => {
        if (!a || !a.is_active) return false;
        if (a.starts_at && a.starts_at > nowIso) return false;
        if (a.ends_at && a.ends_at < nowIso) return false;
        return true;
      });
  } catch {
    return [];
  }
}
