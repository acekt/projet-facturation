import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { 
  getLicenseStatus, 
  assertLicenseAllowsCreation, 
  updateCachedLicenseStatus, 
  LicenseRestrictedError 
} from '@/lib/api/license';
import { migrateLegacyDatabase } from '@/lib/db/migrateLegacy';
import { EnrollmentService } from '@/lib/services/EnrollmentService';

describe('Phase 2 : Enrollment, License Management & SQLite Migration', () => {
  // ---------------------------------------------------------------------------
  // 1. GESTION DES LICENCES & CONSULTATION SEULE (Tâche 2.3)
  // ---------------------------------------------------------------------------
  describe('License Management & Read-Only Guard', () => {
    const testTenantId = 'tenant-test-uuid-001';

    it('1.1 Should return active status for null tenantId (initial/bootstrap)', () => {
      const status = getLicenseStatus(null);
      expect(status.status).toBe('active');
      expect(status.isReadOnly).toBe(false);
      expect(status.isInGracePeriod).toBe(false);
    });

    it('1.2 Should allow creation when license is active and not expired', () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      updateCachedLicenseStatus(testTenantId, 'active', futureDate);

      const status = getLicenseStatus(testTenantId);
      expect(status.status).toBe('active');
      expect(status.isReadOnly).toBe(false);
      expect(status.daysRemaining).toBeGreaterThan(0);
      expect(() => assertLicenseAllowsCreation(testTenantId)).not.toThrow();
    });

    it('1.3 Should activate grace period when expired recently (< 7 days)', () => {
      // Expiré il y a 2 jours
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      updateCachedLicenseStatus(testTenantId, 'active', pastDate);

      const status = getLicenseStatus(testTenantId);
      expect(status.isInGracePeriod).toBe(true);
      expect(status.isReadOnly).toBe(false); // Toléré pendant la période de grâce
      expect(status.message).toContain('Période de grâce active');
      // La création reste permise avec warning
      expect(() => assertLicenseAllowsCreation(testTenantId)).not.toThrow();
    });

    it('1.4 Should strictly lock to read-only when grace period is exceeded (> 7 days)', () => {
      // Expiré il y a 10 jours
      const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      updateCachedLicenseStatus(testTenantId, 'active', pastDate);

      const status = getLicenseStatus(testTenantId);
      expect(status.isReadOnly).toBe(true);
      expect(status.status).toBe('expired');
      expect(status.message).toContain('mode consultation seule');

      expect(() => assertLicenseAllowsCreation(testTenantId)).toThrow(LicenseRestrictedError);
    });

    it('1.5 Should lock to read-only when license status is explicitly expired', () => {
      updateCachedLicenseStatus(testTenantId, 'expired', null);

      const status = getLicenseStatus(testTenantId);
      expect(status.isReadOnly).toBe(true);
      expect(status.status).toBe('expired');
      expect(() => assertLicenseAllowsCreation(testTenantId)).toThrow(LicenseRestrictedError);
    });

    it('1.6 Should lock to read-only when tenant is suspended administratively', () => {
      updateCachedLicenseStatus(testTenantId, 'suspended', null);

      const status = getLicenseStatus(testTenantId);
      expect(status.isReadOnly).toBe(true);
      expect(status.status).toBe('suspended');
      expect(status.message).toContain('suspendu par l\'administrateur');

      expect(() => assertLicenseAllowsCreation(testTenantId)).toThrowError(
        /suspendu/i
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 2. MIGRATION AUTOMATIQUE V1 ➔ V2 SQLITE (Tâche 2.2)
  // ---------------------------------------------------------------------------
  describe('Legacy SQLite V1 to V2 Migration', () => {
    let tempDir: string;
    let tempDbPath: string;
    let testDb: Database.Database;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'facturier-mig-test-'));
      tempDbPath = path.join(tempDir, 'legacy_test.sqlite');
      testDb = new Database(tempDbPath);

      // Création d'une base V1 legacy avec des clés numériques et absence de tenant_id
      testDb.exec(`
        CREATE TABLE sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

        CREATE TABLE clients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT,
          address TEXT,
          deletedAt DATETIME
        );

        CREATE TABLE quotes (
          id TEXT PRIMARY KEY,
          number TEXT NOT NULL,
          clientId TEXT NOT NULL,
          clientName TEXT NOT NULL,
          clientEmail TEXT NOT NULL,
          date TEXT NOT NULL,
          subtotal REAL NOT NULL,
          discount REAL NOT NULL,
          taxBase REAL NOT NULL,
          tvaAmount REAL NOT NULL,
          cssAmount REAL NOT NULL,
          total REAL NOT NULL,
          status TEXT NOT NULL,
          created_by TEXT,
          deletedAt DATETIME
        );

        CREATE TABLE quote_items (
          id TEXT PRIMARY KEY,
          quoteId TEXT NOT NULL,
          description TEXT NOT NULL,
          quantity REAL NOT NULL,
          unitPrice REAL NOT NULL,
          total REAL NOT NULL
        );

        CREATE TABLE settings (
          id INTEGER PRIMARY KEY,
          companyName TEXT,
          email TEXT
        );

        INSERT INTO settings (id, companyName, email) VALUES (1, 'Entreprise Legacy SARL', 'contact@legacy.ga');
        INSERT INTO clients (id, name, email) VALUES ('1', 'Client Ancien 1', 'client1@test.ga');
        INSERT INTO clients (id, name, email) VALUES ('2', 'Client Ancien 2', 'client2@test.ga');
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tvaAmount, cssAmount, total, status)
        VALUES ('100', 'DEV-2024-001', '1', 'Client Ancien 1', 'client1@test.ga', '2024-01-01', 1000, 0, 1000, 180, 10, 1190, 'EN_ATTENTE');
        INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
        VALUES ('item-1', '100', 'Prestation informatique', 1, 1000, 1000);
      `);
    });

    afterEach(() => {
      try {
        testDb.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    });

    it('2.1 Should detect legacy tables, backup file and perform V1->V2 migration', () => {
      const report = migrateLegacyDatabase(testDb, tempDbPath);

      expect(report.needed).toBe(true);
      expect(report.backupCreated).toBe(true);
      expect(report.backupPath).toBeDefined();
      expect(fs.existsSync(report.backupPath!)).toBe(true);
      expect(report.backfilledRows).toBeGreaterThan(0);
      expect(report.idRemappedCount).toBeGreaterThan(0);

      // Vérifier que tenant_id a été injecté
      const clientCols = (testDb.prepare('PRAGMA table_info(clients)').all() as any[]).map((c) => c.name);
      expect(clientCols).toContain('tenant_id');

      const clients = testDb.prepare('SELECT id, tenant_id FROM clients').all() as any[];
      expect(clients.length).toBe(2);
      for (const c of clients) {
        expect(c.tenant_id).toBe(report.tenantId);
        // ID remappé en UUID valide
        expect(c.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      }

      // Vérifier la cohérence de la relation quote -> client
      const quotes = testDb.prepare('SELECT id, clientId, tenant_id FROM quotes').all() as any[];
      expect(quotes.length).toBe(1);
      expect(quotes[0].tenant_id).toBe(report.tenantId);
      expect(quotes[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

      // Le clientId du devis doit correspondre au nouvel UUID du premier client
      const matchingClient = clients.find((c) => c.id === quotes[0].clientId);
      expect(matchingClient).toBeDefined();

      // Vérifier la cohérence quote_items -> quoteId
      const items = testDb.prepare('SELECT quoteId FROM quote_items').all() as any[];
      expect(items[0].quoteId).toBe(quotes[0].id);
    });

    it('2.2 Migration must be idempotent (no duplicate work on second run)', () => {
      // 1er passage
      migrateLegacyDatabase(testDb, tempDbPath);

      // 2nd passage
      const secondRun = migrateLegacyDatabase(testDb, tempDbPath);
      expect(secondRun.needed).toBe(false);
      expect(secondRun.backupCreated).toBe(false);
      expect(secondRun.backfilledRows).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. ENRÔLEMENT POSTE & REJOINDRE ORGANISATION (Tâche 2.1)
  // ---------------------------------------------------------------------------
  describe('Enrollment Service Validation', () => {
    it('3.1 Should reject invalid email or short password before calling network', async () => {
      await expect(
        EnrollmentService.enrollWithCloudTenant({ email: 'bad-email', password: '123' })
      ).rejects.toThrow('Adresse email invalide');

      await expect(
        EnrollmentService.enrollWithCloudTenant({ email: 'valid@test.ga', password: '123' })
      ).rejects.toThrow('au moins 6 caractères');
    });
  });
});
