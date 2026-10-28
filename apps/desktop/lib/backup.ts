import db from '@/lib/db';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Service de Sauvegarde Vérifiée (Lot C — D5)
 * Utilise l'API native `db.backup()` de better-sqlite3 pour garantir
 * une copie cohérente même en mode WAL, suivie d'un `PRAGMA integrity_check`.
 */

export interface BackupMetadata {
  filename: string;
  filepath: string;
  sizeBytes: number;
  createdAt: string;
  label: string;
}

/**
 * Crée une sauvegarde cohérente et intègre de la base SQLite active.
 * Exécutée dans le processus Next.js qui détient la connexion en écriture.
 */
export async function createVerifiedBackup(dir: string, label: string = 'manual'): Promise<string> {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dest = path.join(dir, `backup_${safeLabel}_${timestamp}.sqlite`);

  // 1. Sauvegarde en ligne cohérente (ne pas utiliser fs.copyFileSync en WAL)
  await db.backup(dest);

  // 2. Vérification d'intégrité stricte
  const Database = (await import('better-sqlite3')).default;
  const check = new Database(dest, { readonly: true });
  const result = check.pragma('integrity_check', { simple: true });
  check.close();

  if (result !== 'ok') {
    if (fs.existsSync(dest)) {
      try {
        fs.unlinkSync(dest);
      } catch {
        // Silencieux
      }
    }
    throw new Error(`Sauvegarde corrompue détectée (${String(result)}) : fichier supprimé.`);
  }

  // 3. Rétention : conserver les 7 sauvegardes les plus récentes du dossier
  pruneBackups(dir, 7);

  return dest;
}

/**
 * Nettoie les anciennes sauvegardes pour ne conserver que les N plus récentes.
 */
export function pruneBackups(dir: string, keepCount: number = 7): void {
  try {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    const backupFiles = files
      .filter((f) => f.startsWith('backup_') && f.endsWith('.sqlite'))
      .map((f) => {
        const full = path.join(dir, f);
        return {
          name: f,
          path: full,
          time: fs.statSync(full).mtime.getTime(),
        };
      })
      .sort((a, b) => b.time - a.time);

    if (backupFiles.length > keepCount) {
      const toDelete = backupFiles.slice(keepCount);
      for (const item of toDelete) {
        try {
          fs.unlinkSync(item.path);
        } catch {
          // Ignorer les erreurs de verrouillage
        }
      }
    }
  } catch {
    // Non bloquant
  }
}

/**
 * Liste les sauvegardes disponibles dans le répertoire donné.
 */
export function listBackups(dir: string): BackupMetadata[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  return files
    .filter((f) => f.startsWith('backup_') && f.endsWith('.sqlite'))
    .map((f) => {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      const parts = f.replace('.sqlite', '').split('_');
      const label = parts.length >= 2 ? parts[1] : 'unknown';
      return {
        filename: f,
        filepath: full,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
        label,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
