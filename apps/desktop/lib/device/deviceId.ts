import crypto from 'crypto';
import os from 'os';
import db from '@/lib/db';

export interface DeviceInfo {
  deviceId: string;
  os: string;
  appVersion: string;
  deviceName: string;
}

/**
 * Récupère ou génère un identifiant de poste stable et persistant dans SQLite local.
 * Cet identifiant permet au Super Admin de superviser la flotte de postes connectés.
 */
export function getOrCreateDeviceId(): string {
  try {
    db.exec('CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT)');

    const row = db.prepare("SELECT value FROM sync_meta WHERE key = 'device_id'").get() as
      | { value: string }
      | undefined;

    if (row?.value) {
      return row.value;
    }

    const newDeviceId = crypto.randomUUID();
    db.prepare(
      "INSERT INTO sync_meta (key, value) VALUES ('device_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(newDeviceId);

    return newDeviceId;
  } catch (error) {
    console.warn('[deviceId] Erreur de persistance SQLite du device_id, fallback mémoire :', error);
    return 'fallback-device-' + os.hostname();
  }
}

/**
 * Retourne les informations techniques du poste de travail pour la télémétrie Hub.
 * Aucune donnée métier ou confidentielle n'est exposée.
 */
export function getDeviceInfo(): DeviceInfo {
  return {
    deviceId: getOrCreateDeviceId(),
    os: `${process.platform} (${os.release()})`,
    appVersion: '1.0.0',
    deviceName: os.hostname(),
  };
}
