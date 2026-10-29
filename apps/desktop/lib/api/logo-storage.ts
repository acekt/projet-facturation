import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import Database from 'better-sqlite3';

function resolveLogosDirectory(): string {
  const electronUserData = process.env['ELECTRON_USERDATA_PATH'];
  if (electronUserData) {
    const dir = path.join(electronUserData, 'logos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  if (process.env.NODE_ENV !== 'production') {
    const dir = path.join(process.cwd(), 'data', 'logos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  const dir = path.join(os.homedir(), '.facturier-invoicing', 'logos');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export interface StoredLogoMeta {
  logoPath: string;
  logoSha256: string;
  absolutePath: string;
}

/**
 * Sauvegarde un logo (base64 data-URI ou Buffer) sur disque local.
 * Nommé par son empreinte sha256 pour déduplication et intégrité.
 */
export function saveLogoToDisk(data: string | Buffer): StoredLogoMeta {
  let buffer: Buffer;

  if (Buffer.isBuffer(data)) {
    buffer = data;
  } else if (typeof data === 'string') {
    if (data.startsWith('data:')) {
      const base64Content = data.split(',')[1] || '';
      buffer = Buffer.from(base64Content, 'base64');
    } else {
      buffer = Buffer.from(data, 'base64');
    }
  } else {
    throw new Error('Données logo invalides : attendu Buffer ou string base64.');
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const logosDir = resolveLogosDirectory();
  const filename = `${hash}.png`;
  const absolutePath = path.join(logosDir, filename);

  if (!fs.existsSync(absolutePath)) {
    fs.writeFileSync(absolutePath, buffer);
  }

  return {
    logoPath: `logos/${filename}`,
    logoSha256: hash,
    absolutePath,
  };
}

/**
 * Récupère le chemin d'accès absolu au fichier de logo local.
 */
export function getLogoDiskPath(logoSha256: string): string | null {
  if (!logoSha256) return null;
  const logosDir = resolveLogosDirectory();
  const absolutePath = path.join(logosDir, `${logoSha256}.png`);
  return fs.existsSync(absolutePath) ? absolutePath : null;
}

/**
 * Migration unique (P12) : extrait le base64 existant de la table settings,
 * le stocke sur le disque local, renseigne logo_path et logo_sha256,
 * et vide settings.logo pour réduire la taille de la base SQLite.
 */
export function migrateInlineLogoToDisk(db: Database.Database): boolean {
  try {
    const row = db.prepare('SELECT logo, logo_path, logo_sha256 FROM settings WHERE id = 1').get() as {
      logo?: string | null;
      logo_path?: string | null;
      logo_sha256?: string | null;
    } | undefined;

    if (!row || !row.logo || !row.logo.startsWith('data:')) {
      return false;
    }

    // Sauvegarde sur disque
    const meta = saveLogoToDisk(row.logo);

    // Mise à jour de la table settings avec logo_path et logo_sha256
    // et suppression du gros base64 inline
    db.prepare(`
      UPDATE settings
      SET logo = NULL,
          logo_path = ?,
          logo_sha256 = ?
      WHERE id = 1
    `).run(meta.logoPath, meta.logoSha256);

    console.log(`[logo-storage] Migration P12 réussie : logo extrait (${meta.logoSha256}) et settings.logo allégé.`);
    return true;
  } catch (err) {
    console.warn('[logo-storage] Échec de la migration du logo inline vers le disque :', err);
    return false;
  }
}
