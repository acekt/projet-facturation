import type { SupabaseClient } from '@supabase/supabase-js';
import { getDeviceInfo } from '@/lib/device/deviceId';
import type { SyncReport } from './CloudSyncService';

/**
 * Transmet de façon asynchrone le rapport technique de synchronisation au Hub Web.
 * Opération "best-effort" : une anomalie réseau de télémétrie ne doit JAMAIS faire
 * échouer la réplication locale des données de facturation.
 */
export async function sendSyncTelemetry(
  sb: SupabaseClient,
  report: SyncReport,
  durationMs: number
): Promise<string | null> {
  try {
    const device = getDeviceInfo();

    const { data: runId, error } = await sb.rpc('hub_record_sync_telemetry', {
      p_device_id: device.deviceId,
      p_os: device.os,
      p_app_version: device.appVersion,
      p_device_name: device.deviceName,
      p_duration_ms: durationMs,
      p_pushed: report.pushed,
      p_pulled: report.pulled,
      p_deleted: report.deleted,
      p_skipped: report.skipped,
      p_error_count: report.errors.length,
      p_errors: report.errors.length > 0 ? report.errors.slice(0, 10) : [],
    });

    if (error) {
      console.warn('[TelemetryReporter] Échec envoi télémétrie Hub (non-bloquant) :', error.message);
      return null;
    }

    return (runId as string) || null;
  } catch (err: unknown) {
    console.warn(
      '[TelemetryReporter] Exception télémétrie (non-bloquante) :',
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}
