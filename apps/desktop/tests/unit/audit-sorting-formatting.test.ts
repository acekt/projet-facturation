import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { ALL_MIGRATIONS } from '@/lib/db/migrations';
import {
  cleanDocumentNumber,
  cleanDocumentNumbersInText,
  formatAuditDetails,
  formatAuditShortDateTimeFr,
  formatAuditDateTimeFr,
} from '@/lib/utils/auditFormatter';

describe('LOT 2 : Audit Logs — Tri Chronologique & Formatage d\'Excellence', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    for (const migration of ALL_MIGRATIONS) {
      migration.up(db);
      db.pragma(`user_version = ${migration.version}`);
    }
  });

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
  });

  describe('1. Correction du Tri Chronologique SQLite (03:43:19 vs 08:21:04)', () => {
    it('Résout le bug ASCII où "T" plaçait 03:43:19 au-dessus de 08:21:04', () => {
      // Ingestion de deux logs : l'un au format ISO ("T") plus tôt le matin, l'autre au format SQLite (" ") plus tard
      const insertStmt = db.prepare(`
        INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details, createdAt, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run('log-early', 'u-1', 'Admin', 'CREATE', 'invoice', 'inv-1', 'Facture matinale', '2026-11-05T03:43:19.000Z', 'default');
      insertStmt.run('log-later', 'u-1', 'Admin', 'CREATE', 'invoice', 'inv-2', 'Facture journée', '2026-11-05 08:21:04', 'default');

      // 1. Démonstration de l'ancien tri erroné : 'T' > ' ' place 03:43:19 en premier
      const flawedOrder = db.prepare('SELECT id, createdAt FROM audit_logs ORDER BY createdAt DESC').all() as Array<{ id: string; createdAt: string }>;
      expect(flawedOrder[0].id).toBe('log-early'); // Ancien bug avéré

      // 2. Démonstration du tri corrigé : datetime(replace(createdAt, 'T', ' ')) DESC, rowid DESC
      const correctedOrder = db.prepare(`
        SELECT id, createdAt
        FROM audit_logs
        ORDER BY datetime(replace(createdAt, 'T', ' ')) DESC, rowid DESC
      `).all() as Array<{ id: string; createdAt: string }>;

      expect(correctedOrder[0].id).toBe('log-later'); // 08:21:04 apparaît bien EN PREMIER
      expect(correctedOrder[1].id).toBe('log-early'); // 03:43:19 apparaît bien EN SECOND
    });

    it('Préserve l\'ordre strict par rowid pour les logs créés à la même seconde', () => {
      const insertStmt = db.prepare(`
        INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details, createdAt, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run('log-same-1', 'u-1', 'Admin', 'CREATE', 'quote', 'q-1', 'Devis A', '2026-11-05T10:00:00.000Z', 'default');
      insertStmt.run('log-same-2', 'u-1', 'Admin', 'CREATE', 'quote', 'q-2', 'Devis B', '2026-11-05T10:00:00.000Z', 'default');

      const logs = db.prepare(`
        SELECT id
        FROM audit_logs
        WHERE id LIKE 'log-same-%'
        ORDER BY datetime(replace(createdAt, 'T', ' ')) DESC, rowid DESC
      `).all() as Array<{ id: string }>;

      expect(logs[0].id).toBe('log-same-2');
      expect(logs[1].id).toBe('log-same-1');
    });
  });

  describe('2. Nettoyage des Suffixes Techniques UUID sur les Numéros de Documents', () => {
    it('Retire les suffixes hexadécimaux techniques d\'UUID sur les références documents', () => {
      expect(cleanDocumentNumber('DEV-101/GM/2026-E8EA')).toBe('DEV-101/GM/2026');
      expect(cleanDocumentNumber('FAC-2026-004-9B3F')).toBe('FAC-2026-004');
      expect(cleanDocumentNumber('AVR-2026/001-A1B2')).toBe('AVR-2026/001');
      expect(cleanDocumentNumber('PRO-2026-1234-CDEF0123')).toBe('PRO-2026-1234');
      expect(cleanDocumentNumber('DEV-2026/101')).toBe('DEV-2026/101'); // Aucun suffixe à retirer
    });

    it('Nettoie les numéros au sein de phrases complètes', () => {
      const text = 'Devis DEV-101/GM/2026-E8EA converti en Facture FAC-2026-008-7A1C avec succès';
      const cleaned = cleanDocumentNumbersInText(text);
      expect(cleaned).toBe('Devis DEV-101/GM/2026 converti en Facture FAC-2026-008 avec succès');
    });

    it('Nettoie les références documents dans formatAuditDetails (JSON et plain text)', () => {
      const jsonDetails = JSON.stringify({
        invoiceNumber: 'FAC-2026-042-E8EA',
        client: 'Total Gabon',
        total: 1500000,
        status: 'PAID'
      });
      const parsed = formatAuditDetails(jsonDetails);
      expect(parsed.humanText).toContain('Facture FAC-2026-042 pour Total Gabon');
      expect(parsed.humanText).not.toContain('E8EA');

      const plainDetails = 'Création du devis DEV-101/GM/2026-E8EA';
      const plainParsed = formatAuditDetails(plainDetails);
      expect(plainParsed.humanText).toBe('Création du devis DEV-101/GM/2026');
    });
  });

  describe('3. Formatage Francophone du Journal & Écritures du Livre des Comptes', () => {
    it('Formate correctement les détails des écritures Dépense (OUT) et Recette (IN)', () => {
      const expenseDetail = 'Dépense enregistrée : 15 000 FCFA (Loyer Commercial)';
      const incomeDetail = 'Recette enregistrée : 450 000 FCFA (Vente Comptant)';

      const expRes = formatAuditDetails(expenseDetail);
      expect(expRes.humanText).toBe('Dépense enregistrée : 15 000 FCFA (Loyer Commercial)');

      const incRes = formatAuditDetails(incomeDetail);
      expect(incRes.humanText).toBe('Recette enregistrée : 450 000 FCFA (Vente Comptant)');
    });

    it('Formate la date court format "DD/MM à HH:mm" pour la timeline', () => {
      const isoDate = '2026-11-05T08:21:04.000Z';
      const formatted = formatAuditShortDateTimeFr(isoDate);
      expect(formatted).toMatch(/^\d{2}\/\d{2} à \d{2}:\d{2}$/);

      const sqliteDate = '2026-11-05 08:21:04';
      const formattedSqlite = formatAuditShortDateTimeFr(sqliteDate);
      expect(formattedSqlite).toMatch(/^\d{2}\/\d{2} à \d{2}:\d{2}$/);
    });
  });
});

