import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Migration } from './types';
import { migration0001 } from './0001_initial_schema';
import { migration0002 } from './0002_schema_hardening';
import { migration0003 } from './0003_backfill_and_sync_schema';

export const ALL_MIGRATIONS: Migration[] = [
  migration0001,
  migration0002,
  migration0003,
];

/**
 * Crée une copie de sauvegarde horodatée avant d'appliquer une migration sur fichier disque.
 */
function createPreMigrationBackup(dbPath: string, targetVersion: number): string | null {
  try {
    if (!dbPath || dbPath === ':memory:' || !fs.existsSync(dbPath)) {
      return null;
    }

    const dir = path.dirname(dbPath);
    const ext = path.extname(dbPath);
    const basename = path.basename(dbPath, ext);
    const backupsDir = path.join(dir, 'backups');

    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${basename}.pre-mig-v${targetVersion}-${timestamp}${ext}`;
    const backupPath = path.join(backupsDir, backupName);

    fs.copyFileSync(dbPath, backupPath);

    // Vérification intégrité de la copie
    const check = new Database(backupPath, { readonly: true });
    const ok = check.pragma('integrity_check', { simple: true }) === 'ok';
    check.close();

    if (!ok) {
      fs.unlinkSync(backupPath);
      console.warn(`[migrations] Échec intégrité de la sauvegarde pour v${targetVersion}`);
      return null;
    }

    return backupPath;
  } catch (err) {
    console.warn('[migrations] Impossible de créer la sauvegarde pré-migration :', err);
    return null;
  }
}

/**
 * Exécute toutes les migrations en attente de manière ordonnée et transactionnelle.
 * Utilise PRAGMA user_version comme source de vérité.
 */
export function runMigrations(db: Database.Database, dbPath?: string): { initialVersion: number; finalVersion: number; appliedCount: number } {
  const currentVersion = Number(db.pragma('user_version', { simple: true }) || 0);
  const pending = ALL_MIGRATIONS
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  if (pending.length === 0) {
    return { initialVersion: currentVersion, finalVersion: currentVersion, appliedCount: 0 };
  }

  console.log(`[migrations] Version actuelle SQLite : ${currentVersion}. ${pending.length} migration(s) en attente.`);

  for (const mig of pending) {
    if (dbPath) {
      const backup = createPreMigrationBackup(dbPath, mig.version);
      if (backup) {
        console.log(`[migrations] Sauvegarde pré-migration v${mig.version} créée : ${backup}`);
      }
    }

    console.log(`[migrations] Application de la migration v${mig.version} : ${mig.name}...`);

    const previousFk = Number(db.pragma('foreign_keys', { simple: true }));
    // SQLite interdit de modifier foreign_keys au sein d'une transaction active
    db.pragma('foreign_keys = OFF');

    const tx = db.transaction(() => {
      mig.up(db);
      db.pragma(`user_version = ${mig.version}`);
    });

    try {
      tx();
      console.log(`[migrations] Migration v${mig.version} (${mig.name}) appliquée avec succès.`);
    } catch (migErr) {
      console.error(`[migrations] ERREUR CRITIQUE migration v${mig.version} (${mig.name}) :`, migErr);
      throw migErr;
    } finally {
      if (previousFk) {
        db.pragma('foreign_keys = ON');
      }
    }
  }

  // Vérification d'intégrité globale
  const integrity = db.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') {
    throw new Error(`[migrations] Base de données corrompue après migrations : ${integrity}`);
  }

  const finalVersion = Number(db.pragma('user_version', { simple: true }));
  console.log(`[migrations] Migrations terminées. Nouvelle version SQLite : ${finalVersion}.`);

  return {
    initialVersion: currentVersion,
    finalVersion,
    appliedCount: pending.length,
  };
}
