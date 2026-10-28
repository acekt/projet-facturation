import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { createVerifiedBackup, pruneBackups, listBackups } from '@/lib/backup';
import { createTestDatabase, cleanupTestDatabase, seedTestData, getTestDatabase } from '../helpers/db';

vi.mock('@/lib/db', async () => {
  const actualDb = await import('../helpers/db');
  return {
    default: actualDb.getTestDatabase(),
  };
});

describe('Lot C — Sauvegarde Vérifiée (D5)', () => {
  let testDb: Database.Database;
  let tempBackupDir: string;

  beforeEach(() => {
    testDb = createTestDatabase();
    seedTestData(testDb);
    tempBackupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'facturier-backup-test-'));
  });

  afterEach(() => {
    cleanupTestDatabase();
    try {
      if (fs.existsSync(tempBackupDir)) {
        fs.rmSync(tempBackupDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore
    }
  });

  it('1. createVerifiedBackup génère une sauvegarde intègre vérifiée par PRAGMA integrity_check', async () => {
    const backupPath = await createVerifiedBackup(tempBackupDir, 'unit_test');

    expect(fs.existsSync(backupPath)).toBe(true);
    expect(backupPath).toContain('backup_unit_test_');
    expect(backupPath.endsWith('.sqlite')).toBe(true);

    // Vérifier l'intégrité indépendamment
    const verifyConn = new Database(backupPath, { readonly: true });
    const integrity = verifyConn.pragma('integrity_check', { simple: true });
    verifyConn.close();

    expect(integrity).toBe('ok');

    // Vérifier que les données sont bien présentes dans la sauvegarde
    const dataConn = new Database(backupPath, { readonly: true });
    const userCount = (dataConn.prepare('SELECT count(*) as c FROM users').get() as { c: number }).c;
    dataConn.close();
    expect(userCount).toBeGreaterThan(0);
  });

  it('2. pruneBackups ne conserve que les N sauvegardes les plus récentes', async () => {
    // Créer 10 faux fichiers de sauvegarde avec des timestamps différents
    for (let i = 1; i <= 10; i++) {
      const filePath = path.join(tempBackupDir, `backup_auto_2026-10-2${i}T12-00-00-000Z.sqlite`);
      fs.writeFileSync(filePath, 'fake-sqlite-content');
      // Forcer le mtime pour trier de manière déterministe
      const time = 1700000000 + i * 1000;
      fs.utimesSync(filePath, time, time);
    }

    const beforePrune = listBackups(tempBackupDir);
    expect(beforePrune.length).toBe(10);

    // Rétention à 7 fichiers
    pruneBackups(tempBackupDir, 7);

    const afterPrune = listBackups(tempBackupDir);
    expect(afterPrune.length).toBe(7);
  });

  it('3. listBackups retourne les métadonnées de sauvegardes triées par date décroissante', async () => {
    const p1 = await createVerifiedBackup(tempBackupDir, 'first');
    // Petite pause pour horodatage distinct
    const p2 = await createVerifiedBackup(tempBackupDir, 'second');

    const backups = listBackups(tempBackupDir);
    expect(backups.length).toBe(2);
    expect(backups[0].filepath).toBe(p2);
    expect(backups[1].filepath).toBe(p1);
    expect(backups[0].sizeBytes).toBeGreaterThan(0);
    expect(backups[0].label).toBe('second');
  });
});
