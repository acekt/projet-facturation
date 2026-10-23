import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrCreateDeviceId, getDeviceInfo } from '@/lib/device/deviceId';
import { sendSyncTelemetry } from '@/lib/sync/TelemetryReporter';

describe('H1 Télémétrie Flotte Desktop & Porte de Licence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. getOrCreateDeviceId génère et réutilise un UUID persistant', () => {
    const id1 = getOrCreateDeviceId();
    const id2 = getOrCreateDeviceId();

    expect(id1).toBeDefined();
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(10);
    // Persistance : deux appels successifs doivent retourner le même identifiant
    expect(id1).toBe(id2);
  });

  it('2. getDeviceInfo retourne des métadonnées techniques non-intrusives', () => {
    const info = getDeviceInfo();

    expect(info.deviceId).toBeDefined();
    expect(info.os).toBeDefined();
    expect(info.appVersion).toBe('1.0.0');
    expect(info.deviceName).toBeDefined();
  });

  it('3. sendSyncTelemetry appelle hub_record_sync_telemetry sans bloquer', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: 'run-uuid-123', error: null });
    const mockSb: any = { rpc: mockRpc };

    const report = {
      tenantId: 'tenant-test-1',
      pushed: 5,
      pulled: 2,
      deleted: 0,
      skipped: 0,
      errors: [],
    };

    const runId = await sendSyncTelemetry(mockSb, report, 350);

    expect(runId).toBe('run-uuid-123');
    expect(mockRpc).toHaveBeenCalledWith('hub_record_sync_telemetry', expect.objectContaining({
      p_duration_ms: 350,
      p_pushed: 5,
      p_pulled: 2,
      p_deleted: 0,
      p_error_count: 0,
    }));
  });

  it('4. sendSyncTelemetry capture les erreurs sans propager d exception', async () => {
    const mockRpc = vi.fn().mockRejectedValue(new Error('Network offline'));
    const mockSb: any = { rpc: mockRpc };

    const report = {
      tenantId: 'tenant-test-1',
      pushed: 0,
      pulled: 0,
      deleted: 0,
      skipped: 0,
      errors: ['Timeout pull'],
    };

    const runId = await sendSyncTelemetry(mockSb, report, 500);
    expect(runId).toBeNull();
  });
});
