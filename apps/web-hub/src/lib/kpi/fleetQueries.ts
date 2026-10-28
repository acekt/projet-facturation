import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireSuperadmin } from "@/lib/auth/dal";

export interface SyncDeviceDetail {
  deviceId: string;
  tenantId: string;
  tenantName: string;
  deviceName: string | null;
  os: string | null;
  appVersion: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastSyncAt: string | null;
  lastStatus: "success" | "error" | "pending";
  metadata?: Record<string, any>;
  stalenessCategory: "active_24h" | "moderate_7d" | "stale_gt_7d";
  daysSinceLastSeen: number;
}

export interface SyncRunDetail {
  id: string;
  tenantId: string;
  tenantName: string;
  deviceId: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  pushed: number;
  pulled: number;
  deleted: number;
  skipped: number;
  errorCount: number;
  errors: any[];
  appVersion: string | null;
  os: string | null;
  createdAt: string;
}

export interface DetailedSyncFleetData {
  summary: {
    totalDevices: number;
    activeLast24h: number;
    active1to7d: number;
    stale7d: number;
    errorDevices: number;
    avgDurationMs: number;
    p95DurationMs: number;
    runsLast24h: number;
    errorsLast24h: number;
    totalPushedLast24h: number;
    totalPulledLast24h: number;
    successRate24h: number;
  };
  devices: SyncDeviceDetail[];
  recentRuns: SyncRunDetail[];
  recentErrors: SyncRunDetail[];
}

/**
 * Calcule le 95ème percentile d'une série de durées en millisecondes.
 */
export function calculateP95(durations: number[]): number {
  if (!durations || durations.length === 0) return 0;
  const sorted = [...durations].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(0.95 * sorted.length) - 1)
  );
  return Math.round(sorted[index]);
}

/**
 * Récupération brute de l'état du parc sans accès aux cookies.
 * Exécution parallèle simultanée des tables sync_devices et sync_runs via Service Role.
 */
async function fetchDetailedSyncFleetRaw(): Promise<DetailedSyncFleetData> {
  const supabase = createAdminClient();

  const now = Date.now();
  const h24Ago = now - 24 * 60 * 60 * 1000;
  const d7Ago = now - 7 * 24 * 60 * 60 * 1000;

  // 1 & 2. Récupération simultanée des postes et exécutions récentes
  const [{ data: devicesData }, { data: runsData }] = await Promise.all([
    supabase
      .from("sync_devices")
      .select(`
        device_id,
        tenant_id,
        device_name,
        os,
        app_version,
        first_seen_at,
        last_seen_at,
        last_sync_at,
        last_status,
        metadata,
        tenants (
          name
        )
      `)
      .order("last_seen_at", { ascending: false }),
    supabase
      .from("sync_runs")
      .select(`
        id,
        tenant_id,
        device_id,
        started_at,
        completed_at,
        duration_ms,
        pushed,
        pulled,
        deleted,
        skipped,
        error_count,
        errors,
        app_version,
        os,
        created_at,
        tenants (
          name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const devices: SyncDeviceDetail[] = (devicesData || []).map((d: any) => {
    const seenMs = new Date(d.last_seen_at).getTime();
    const daysSince = Math.max(0, Math.floor((now - seenMs) / (24 * 60 * 60 * 1000)));

    let stalenessCategory: "active_24h" | "moderate_7d" | "stale_gt_7d" = "active_24h";
    if (seenMs < d7Ago) {
      stalenessCategory = "stale_gt_7d";
    } else if (seenMs < h24Ago) {
      stalenessCategory = "moderate_7d";
    }

    return {
      deviceId: d.device_id,
      tenantId: d.tenant_id,
      tenantName: d.tenants?.name || "Entreprise inconnue",
      deviceName: d.device_name || null,
      os: d.os || null,
      appVersion: d.app_version || null,
      firstSeenAt: d.first_seen_at,
      lastSeenAt: d.last_seen_at,
      lastSyncAt: d.last_sync_at || null,
      lastStatus: (d.last_status as any) || "success",
      metadata: d.metadata || {},
      stalenessCategory,
      daysSinceLastSeen: daysSince,
    };
  });

  const recentRuns: SyncRunDetail[] = (runsData || []).map((r: any) => ({
    id: r.id,
    tenantId: r.tenant_id,
    tenantName: r.tenants?.name || "Entreprise",
    deviceId: r.device_id,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    durationMs: Number(r.duration_ms) || 0,
    pushed: Number(r.pushed) || 0,
    pulled: Number(r.pulled) || 0,
    deleted: Number(r.deleted) || 0,
    skipped: Number(r.skipped) || 0,
    errorCount: Number(r.error_count) || 0,
    errors: Array.isArray(r.errors) ? r.errors : [],
    appVersion: r.app_version || null,
    os: r.os || null,
    createdAt: r.created_at,
  }));

  // 3. Calcul des métriques SLA & 24h
  let activeLast24h = 0;
  let active1to7d = 0;
  let stale7d = 0;
  let errorDevices = 0;

  devices.forEach((d) => {
    if (d.stalenessCategory === "active_24h") activeLast24h++;
    else if (d.stalenessCategory === "moderate_7d") active1to7d++;
    else if (d.stalenessCategory === "stale_gt_7d") stale7d++;

    if (d.lastStatus === "error") errorDevices++;
  });

  const validDurations = recentRuns.map((r) => r.durationMs).filter((d) => d > 0);
  const avgDurationMs =
    validDurations.length > 0
      ? Math.round(validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length)
      : 0;
  const p95DurationMs = calculateP95(validDurations);

  let runsLast24h = 0;
  let errorsLast24h = 0;
  let totalPushedLast24h = 0;
  let totalPulledLast24h = 0;

  recentRuns.forEach((r) => {
    const runTime = new Date(r.createdAt).getTime();
    if (runTime >= h24Ago) {
      runsLast24h++;
      if (r.errorCount > 0) errorsLast24h++;
      totalPushedLast24h += r.pushed;
      totalPulledLast24h += r.pulled;
    }
  });

  const successRate24h =
    runsLast24h > 0
      ? Math.round(((runsLast24h - errorsLast24h) / runsLast24h) * 100)
      : 100;

  const recentErrors = recentRuns.filter(
    (r) => r.errorCount > 0 || (r.errors && r.errors.length > 0)
  );

  return {
    summary: {
      totalDevices: devices.length,
      activeLast24h,
      active1to7d,
      stale7d,
      errorDevices,
      avgDurationMs,
      p95DurationMs,
      runsLast24h,
      errorsLast24h,
      totalPushedLast24h,
      totalPulledLast24h,
      successRate24h,
    },
    devices,
    recentRuns,
    recentErrors,
  };
}

/**
 * Cache intermédiaire sur le Data Cache Next.js (Vercel Edge / Node).
 * Revalidation toutes les 15s avec tag d'invalidation 'hub-sync'.
 */
const getCachedDetailedSyncFleet = unstable_cache(
  fetchDetailedSyncFleetRaw,
  ["hub-detailed-sync-fleet"],
  {
    revalidate: 15,
    tags: ["hub-fleet", "hub-sync"],
  }
);

/**
 * Point d'entrée sécurisé pour les composants serveur du Hub.
 * Valide l'authentification Superadmin puis sert les métriques de la flotte depuis le Data Cache en 0ms.
 */
export const getDetailedSyncFleet = cache(async (): Promise<DetailedSyncFleetData> => {
  await requireSuperadmin();
  return getCachedDetailedSyncFleet();
});
