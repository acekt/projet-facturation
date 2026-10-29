import { describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import { escapeCsvCell } from '@/lib/utils';
import { DEFAULT_SETTINGS } from '@/lib/store/types';
import { runMigrations, ALL_MIGRATIONS } from '@/lib/db/migrations';
import { dispatchCommandNavigation } from '@/lib/command-navigation';

describe('Phase 1 — Plan Correctif Desktop (ADR-0044)', () => {
  it('C1 — DEFAULT_SETTINGS applique le taux légal CSS gabonais de 1%', () => {
    expect(DEFAULT_SETTINGS.cssRate).toBe(1);
    expect(DEFAULT_SETTINGS.tpsRate).toBe(9.5);
    expect(DEFAULT_SETTINGS.tvaRate).toBe(18);
  });

  it('C2 — escapeCsvCell neutralise les formules tableur malveillantes tout en préservant les numéros +241', () => {
    expect(escapeCsvCell('=CMD|\'/C calc\'!A0')).toBe('"\'=CMD|\'/C calc\'!A0"');
    expect(escapeCsvCell('@SUM(A1:A10)')).toBe('"\'@SUM(A1:A10)"');
    expect(escapeCsvCell('+HYPERLINK("http://evil")')).toBe('"\'+HYPERLINK(""http://evil"")"');
    expect(escapeCsvCell('-EXEC("cmd")')).toBe('"\'-EXEC(""cmd"")"');
    // Un numéro de téléphone gabonais standard ou un motif avec virgule reste intact
    expect(escapeCsvCell('+241 074 00 00 00')).toBe('"+241 074 00 00 00"');
    expect(escapeCsvCell('Retour marchandise, lot B')).toBe('"Retour marchandise, lot B"');
  });

  it('C6 — dispatchCommandNavigation invoque onNavigate et émet l événement facturier:command-navigate', () => {
    const onNavigate = vi.fn();
    const listener = vi.fn();
    window.addEventListener('facturier:command-navigate', listener);

    dispatchCommandNavigation(onNavigate, 'invoices', 'FAC-2026-0042');

    expect(onNavigate).toHaveBeenCalledWith('invoices');
    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent<{ page: string; searchQuery: string }>;
    expect(event.detail).toEqual({ page: 'invoices', searchQuery: 'FAC-2026-0042' });

    window.removeEventListener('facturier:command-navigate', listener);
  });

  it('C8 — validateSender (main/ipc.js) autorise uniquement le frame principal local 127.0.0.1 / localhost', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { validateSender } = require('../../main/ipc');

    expect(validateSender({ origin: 'http://127.0.0.1:3000', parent: null })).toBe(true);
    expect(validateSender({ origin: 'http://localhost:3000', parent: null })).toBe(true);
    expect(validateSender({ origin: 'https://evil.example.com', parent: null })).toBe(false);
    // Un iframe imbriqué (parent non null) doit être rejeté
    expect(validateSender({ origin: 'http://127.0.0.1:3000', parent: { origin: 'http://127.0.0.1:3000' } })).toBe(false);
  });

  it('C9 — Migration 0003 backfill payments.created_by et initialise _sync_outbox de façon versionnée', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const report = runMigrations(db);
    expect(report.finalVersion).toBe(3);
    expect(ALL_MIGRATIONS.some((m) => m.version === 3 && m.name === '0003_backfill_and_sync_schema')).toBe(true);

    const syncMetaExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sync_meta'")
      .get() as { name: string } | undefined;
    expect(syncMetaExists?.name).toBe('sync_meta');

    db.close();
  });
});

