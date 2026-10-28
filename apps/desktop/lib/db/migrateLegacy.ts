import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';

export interface ILegacyMigrationReport {
  needed: boolean;
  backupCreated: boolean;
  backupPath?: string;
  migratedTables: string[];
  backfilledRows: number;
  idRemappedCount: number;
  tenantId: string;
  timestamp: string;
}

const LEGACY_TABLES = [
  'clients',
  'quotes',
  'quote_items',
  'invoices',
  'invoice_items',
  'payments',
  'services',
  'users',
  'credit_notes',
  'credit_note_items',
  'audit_logs',
] as const;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id: unknown): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

/**
 * Crée une sauvegarde horodatée sécurisée de la base SQLite avant migration.
 */
function createTimestampedBackup(dbPath: string): string | null {
  try {
    if (!fs.existsSync(dbPath)) return null;

    const dir = path.dirname(dbPath);
    const ext = path.extname(dbPath);
    const basename = path.basename(dbPath, ext);
    const backupsDir = path.join(dir, 'backups');

    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${basename}.v1-backup-${timestamp}${ext}`;
    const backupPath = path.join(backupsDir, backupName);

    fs.copyFileSync(dbPath, backupPath);

    // Vérification d'intégrité de la sauvegarde (D5)
    try {
      const check = new Database(backupPath, { readonly: true });
      const ok = check.pragma('integrity_check', { simple: true }) === 'ok';
      check.close();
      if (!ok) {
        fs.unlinkSync(backupPath);
        throw new Error('Sauvegarde V1 corrompue : annulée.');
      }
    } catch (e: any) {
      console.warn('[migrateLegacy] Avertissement intégrité sauvegarde :', e.message);
    }

    // Nettoyage : conserver au maximum 5 sauvegardes récentes
    try {
      const files = fs.readdirSync(backupsDir)
        .filter((f: string) => f.startsWith(`${basename}.v1-backup-`) && f.endsWith(ext))
        .map((f: string) => path.join(backupsDir, f))
        .sort((a: string, b: string) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

      if (files.length > 5) {
        for (const oldFile of files.slice(5)) {
          fs.unlinkSync(oldFile);
        }
      }
    } catch {
      // Ignorer l'erreur de rotation
    }

    return backupPath;
  } catch (err) {
    console.warn('[migrateLegacy] Impossible de créer la copie de sauvegarde :', err);
    return null;
  }
}

/**
 * Exécute la migration automatique V1 ➔ V2 de la base SQLite locale.
 * - Idempotente (vérifie `sync_meta` et l'état des tables)
 * - Sauvegarde horodatée avant toute modification
 * - Backfill de `tenant_id` sur toutes les tables
 * - Normalisation des IDs numériques ou non-UUID en UUIDv4
 */
export function migrateLegacyDatabase(
  db: Database.Database,
  dbPath?: string
): ILegacyMigrationReport {
  const timestamp = new Date().toISOString();
  const report: ILegacyMigrationReport = {
    needed: false,
    backupCreated: false,
    migratedTables: [],
    backfilledRows: 0,
    idRemappedCount: 0,
    tenantId: '',
    timestamp,
  };

  // 1. S'assurer que sync_meta existe pour stocker l'état
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  } catch {
    // ignore
  }

  // 2. Vérifier si la migration est nécessaire
  let needsMigration = false;
  let targetTenantId = '';

  // Détection du tenant existant
  try {
    const adminUser = db
      .prepare("SELECT tenant_id FROM users WHERE role = 'admin' AND tenant_id IS NOT NULL AND tenant_id != '' LIMIT 1")
      .get() as { tenant_id?: string } | undefined;
    if (adminUser?.tenant_id) {
      targetTenantId = adminUser.tenant_id;
    }
  } catch {
    // table users peut ne pas être prête
  }

  if (!targetTenantId) {
    try {
      const settingRow = db
        .prepare('SELECT tenant_id FROM settings WHERE id = 1 AND tenant_id IS NOT NULL AND tenant_id != \'\'')
        .get() as { tenant_id?: string } | undefined;
      if (settingRow?.tenant_id) {
        targetTenantId = settingRow.tenant_id;
      }
    } catch {
      // ignore
    }
  }

  // Si toujours pas de tenantId, on en génère un par défaut
  if (!targetTenantId) {
    targetTenantId = crypto.randomUUID();
  }
  report.tenantId = targetTenantId;

  const tableExists = (tbl: string) => {
    try {
      const cols = db.prepare(`PRAGMA table_info(${tbl})`).all();
      return cols.length > 0;
    } catch {
      return false;
    }
  };

  // Vérifier la présence de lignes sans tenant_id
  for (const table of LEGACY_TABLES) {
    try {
      const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
      if (cols.length === 0) continue;

      if (!cols.includes('tenant_id')) {
        needsMigration = true;
        break;
      }

      const orphanCount = db
        .prepare(`SELECT COUNT(*) as c FROM ${table} WHERE tenant_id IS NULL OR tenant_id = ''`)
        .get() as { c: number } | undefined;

      if ((orphanCount?.c || 0) > 0) {
        needsMigration = true;
        break;
      }
    } catch {
      // Table non existante, continuer
    }
  }

  // Vérifier la présence d'IDs non-UUID dans les tables principales (clients, invoices, quotes)
  const tablesWithIdsToCheck = ['clients', 'quotes', 'invoices', 'services', 'credit_notes'] as const;
  for (const table of tablesWithIdsToCheck) {
    try {
      if (!tableExists(table)) continue;
      const sample = db.prepare(`SELECT id FROM ${table} LIMIT 50`).all() as Array<{ id: unknown }>;
      for (const row of sample) {
        if (row.id && !isValidUuid(row.id)) {
          needsMigration = true;
          break;
        }
      }
      if (needsMigration) break;
    } catch {
      // ignore
    }
  }

  if (!needsMigration) {
    return report;
  }

  report.needed = true;

  // 3. Création du backup horodaté
  if (dbPath) {
    const backup = createTimestampedBackup(dbPath);
    if (backup) {
      report.backupCreated = true;
      report.backupPath = backup;
      try {
        db.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)').run(
          'migration:v1_to_v2_backup',
          backup
        );
      } catch {
        // ignore
      }
    }
  }

  // 4. Exécution de la migration dans une transaction atomique
  const runMigrationTx = db.transaction(() => {
    // A. Backfill des tenant_id
    for (const table of LEGACY_TABLES) {
      try {
        const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
        if (cols.length === 0) continue;

        if (!cols.includes('tenant_id')) {
          db.prepare(`ALTER TABLE ${table} ADD COLUMN tenant_id TEXT`).run();
        }

        const res = db
          .prepare(`UPDATE ${table} SET tenant_id = ? WHERE tenant_id IS NULL OR tenant_id = ''`)
          .run(targetTenantId);

        if (res.changes > 0) {
          report.migratedTables.push(table);
          report.backfilledRows += res.changes;
        }
      } catch (tableErr) {
        console.warn(`[migrateLegacy] Table ${table} sautée ou inexistante :`, tableErr);
      }
    }

    // B. Mettre à jour settings.tenant_id si présent
    try {
      if (tableExists('settings')) {
        const settingsCols = (db.prepare('PRAGMA table_info(settings)').all() as Array<{ name: string }>).map((c) => c.name);
        if (!settingsCols.includes('tenant_id')) {
          db.prepare('ALTER TABLE settings ADD COLUMN tenant_id TEXT').run();
        }
        db.prepare("UPDATE settings SET tenant_id = ? WHERE id = 1 AND (tenant_id IS NULL OR tenant_id = '')").run(
          targetTenantId
        );
      }
    } catch {
      // ignore
    }

    // C. Normalisation des IDs non-UUID (ex: anciens IDs entiers '1', '2'...)
    // Table clients -> quotes.clientId, invoices.clientId, credit_notes.clientId
    if (tableExists('clients')) {
      try {
        const legacyClients = db.prepare('SELECT id FROM clients').all() as Array<{ id: unknown }>;
        for (const client of legacyClients) {
          const oldId = String(client.id);
          if (!isValidUuid(oldId)) {
            const newId = crypto.randomUUID();
            db.prepare('UPDATE clients SET id = ? WHERE id = ?').run(newId, oldId);
            if (tableExists('quotes')) db.prepare('UPDATE quotes SET clientId = ? WHERE clientId = ?').run(newId, oldId);
            if (tableExists('invoices')) db.prepare('UPDATE invoices SET clientId = ? WHERE clientId = ?').run(newId, oldId);
            if (tableExists('credit_notes')) db.prepare('UPDATE credit_notes SET clientId = ? WHERE clientId = ?').run(newId, oldId);
            report.idRemappedCount++;
          }
        }
      } catch (e) {
        console.warn('[migrateLegacy] clients remapping warning:', e);
      }
    }

    // Table quotes -> quote_items.quoteId, invoices.quoteId
    if (tableExists('quotes')) {
      try {
        const legacyQuotes = db.prepare('SELECT id FROM quotes').all() as Array<{ id: unknown }>;
        for (const quote of legacyQuotes) {
          const oldId = String(quote.id);
          if (!isValidUuid(oldId)) {
            const newId = crypto.randomUUID();
            db.prepare('UPDATE quotes SET id = ? WHERE id = ?').run(newId, oldId);
            if (tableExists('quote_items')) db.prepare('UPDATE quote_items SET quoteId = ? WHERE quoteId = ?').run(newId, oldId);
            if (tableExists('invoices')) db.prepare('UPDATE invoices SET quoteId = ? WHERE quoteId = ?').run(newId, oldId);
            report.idRemappedCount++;
          }
        }
      } catch (e) {
        console.warn('[migrateLegacy] quotes remapping warning:', e);
      }
    }

    // Table invoices -> invoice_items.invoiceId, payments.invoiceId, credit_notes.invoiceId
    if (tableExists('invoices')) {
      try {
        const legacyInvoices = db.prepare('SELECT id FROM invoices').all() as Array<{ id: unknown }>;
        for (const inv of legacyInvoices) {
          const oldId = String(inv.id);
          if (!isValidUuid(oldId)) {
            const newId = crypto.randomUUID();
            db.prepare('UPDATE invoices SET id = ? WHERE id = ?').run(newId, oldId);
            if (tableExists('invoice_items')) db.prepare('UPDATE invoice_items SET invoiceId = ? WHERE invoiceId = ?').run(newId, oldId);
            if (tableExists('payments')) db.prepare('UPDATE payments SET invoiceId = ? WHERE invoiceId = ?').run(newId, oldId);
            if (tableExists('credit_notes')) db.prepare('UPDATE credit_notes SET invoiceId = ? WHERE invoiceId = ?').run(newId, oldId);
            report.idRemappedCount++;
          }
        }
      } catch (e) {
        console.warn('[migrateLegacy] invoices remapping warning:', e);
      }
    }

    // Table services
    if (tableExists('services')) {
      try {
        const legacyServices = db.prepare('SELECT id FROM services').all() as Array<{ id: unknown }>;
        for (const s of legacyServices) {
          const oldId = String(s.id);
          if (!isValidUuid(oldId)) {
            const newId = crypto.randomUUID();
            db.prepare('UPDATE services SET id = ? WHERE id = ?').run(newId, oldId);
            report.idRemappedCount++;
          }
        }
      } catch (e) {
        console.warn('[migrateLegacy] services remapping warning:', e);
      }
    }

    // Marquer la migration terminée dans sync_meta
    db.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)').run(
      'migration:v1_to_v2_status',
      'completed'
    );
    db.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)').run(
      'migration:v1_to_v2_at',
      timestamp
    );
    db.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)').run(
      'migration:v1_to_v2_rows',
      String(report.backfilledRows)
    );
  });

  runMigrationTx();

  console.log(
    `[migrateLegacy] Migration V1 -> V2 réussie. ${report.backfilledRows} lignes rattachées au tenant ${targetTenantId}. Sauvegarde : ${report.backupPath || 'N/A'}`
  );

  return report;
}
