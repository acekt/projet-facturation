import { ROLES, QUOTE_STATUS, INVOICE_STATUS, CLIENT_STATUS } from '@/lib/constants';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from '@/lib/store';
import {
  GET as GETAuditLogs,
  POST as POSTAuditLog,
  PUT as PUTAuditLog,
  PATCH as PATCHAuditLog,
  DELETE as DELETEAuditLog,
} from '@/app/api/audit-logs/route';
import { GET as GETSettings, PATCH as PATCHSettings } from '@/app/api/settings/route';
import { DELETE as DELETEClient } from '@/app/api/clients/[id]/route';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
  verifySignature: vi.fn(),
  signSessionCookie: vi.fn(),
}));

describe('🚨 PHASE 9/10 : AUDIT TDD — PARAMÈTRES & JOURNAL D’AUDIT (APPEND-ONLY 405, TRAÇABILITÉ, RBAC, DGI) 🚨', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    db.prepare('DELETE FROM credit_note_items').run();
    db.prepare('DELETE FROM credit_notes').run();
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM quote_items').run();
    db.prepare('DELETE FROM quotes').run();
    db.prepare('DELETE FROM audit_logs').run();
    db.prepare('DELETE FROM clients').run();
    db.prepare(`
      INSERT OR REPLACE INTO settings (id, companyName, legalForm, nif, rccm, address, email, phone, bankName, bankAgency, accountNumber, swiftCode, iban, tvaRate, tpsRate, cssRate, sessionTimeout, invoicePrefix, quotePrefix, companyCode)
      VALUES (1, 'Facturier', 'SARL', 'NIF123', 'RCCM123', 'Libreville', 'contact@facturier.ga', '01020304', 'BGFI', 'AG1', 'ACC123', 'SWIFT1', 'IBAN1', 18, 9.5, 1, 3600, 'FAC', 'DEV', 'GAB')
    `).run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // SCÉNARIO 1 : IMMUABILITÉ ABSOLUE DU JOURNAL (APPEND-ONLY 405)
  // ==========================================================================
  describe('1. Immuabilité Absolue du Journal d’Audit (Append-Only 405 Method Not Allowed)', () => {
    it('devrait rejeter fermement en 405 toute tentative de POST, PUT, PATCH ou DELETE sur /api/audit-logs par tout rôle', async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: 'admin-1',
        role: ROLES.ADMIN,
        username: 'admin',
        expiresAt: Date.now() + 3600000,
      });

      const postRes = await POSTAuditLog();
      expect(postRes.status).toBe(405);
      const postData = await postRes.json();
      expect(postData.error).toContain('append-only and immutable');

      const putRes = await PUTAuditLog();
      expect(putRes.status).toBe(405);

      const patchRes = await PATCHAuditLog();
      expect(patchRes.status).toBe(405);

      const delRes = await DELETEAuditLog();
      expect(delRes.status).toBe(405);
    });
  });

  // ==========================================================================
  // SCÉNARIO 2 : TRAÇABILITÉ AUTOMATIQUE
  // ==========================================================================
  describe('2. Traçabilité Automatique des Actions Sensibles (ex: suppression de client)', () => {
    it('devrait insérer automatiquement une ligne détaillée dans audit_logs lors de la suppression administrative d’un client', async () => {
      db.prepare(`
        INSERT INTO clients (id, name, email, created_by)
        VALUES ('client-trace-1', 'Client Audité', 'trace@facturier.ga', 'admin-trace')
      `).run();

      vi.mocked(getSession).mockResolvedValue({
        userId: 'admin-trace',
        role: ROLES.ADMIN,
        username: 'admin_audit',
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('http://localhost/api/clients/client-trace-1', { method: 'DELETE' });
      const res = await DELETEClient(req, { params: Promise.resolve({ id: 'client-trace-1' }) });
      expect(res.status).toBe(200);

      // Vérification physique dans la table SQLite audit_logs
      const logEntry = db.prepare('SELECT * FROM audit_logs WHERE entityId = ?').get('client-trace-1') as any;
      expect(logEntry).toBeDefined();
      expect(logEntry.action).toBe('DELETE');
      expect(logEntry.entityType).toBe('client');
      expect(logEntry.userId).toBe('admin-trace');
      expect(logEntry.userName).toBe('admin_audit');
      expect(logEntry.details).toContain('Client supprimé: Client Audité');
    });
  });

  // ==========================================================================
  // SCÉNARIO 3 : RBAC STRICT SUR LA BOÎTE NOIRE & PARAMÈTRES
  // ==========================================================================
  describe('3. RBAC Strict sur Audit & Paramètres (403 Forbidden pour operator / user)', () => {
    it('devrait interdire à un opérateur d’accéder à GET /api/audit-logs ou de modifier les paramètres de l’entreprise', async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: 'oper-1',
        role: ROLES.USER, // non-admin
        username: 'oper',
        expiresAt: Date.now() + 3600000,
      });

      const getLogsRes = await GETAuditLogs();
      expect(getLogsRes.status).toBe(403);

      const patchSettingsRes = await PATCHSettings(
        new Request('http://localhost/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyName: 'Hacked Ltd' }),
        })
      );
      expect(patchSettingsRes.status).toBe(403);

      // Vérifions qu'un administrateur a en revanche bien accès
      vi.mocked(getSession).mockResolvedValue({
        userId: 'admin-1',
        role: ROLES.ADMIN,
        username: 'admin',
        expiresAt: Date.now() + 3600000,
      });

      const adminLogsRes = await GETAuditLogs();
      expect(adminLogsRes.status).toBe(200);
    });
  });

  // ==========================================================================
  // SCÉNARIO 4 : INTÉGRITÉ DES PARAMÈTRES DGI & STORE ZUSTAND
  // ==========================================================================
  describe('4. Intégrité des Paramètres DGI (Zod) & Comportement du Store Zustand', () => {
    it('devrait rejeter une mise à jour des paramètres avec un taux TVA négatif ou des données invalides via Zod', async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: 'admin-1',
        role: ROLES.ADMIN,
        username: 'admin',
        expiresAt: Date.now() + 3600000,
      });

      // Taux TVA négatif (-5%) et NIF invalide (numéro au lieu de string si requis)
      const req = new Request('http://localhost/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tvaRate: -5,
          companyName: '', // Nom vide
        }),
      });

      const res = await PATCHSettings(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Données invalides');
      expect(data.details.fieldErrors.tvaRate).toBeDefined();
    });

    it('devrait permettre de mettre à jour légitimement les identifiants fiscaux NIF / RCCM par l’administrateur', async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: 'admin-1',
        role: ROLES.ADMIN,
        username: 'admin',
        expiresAt: Date.now() + 3600000,
      });

      const fullSettings = {
        companyName: 'Facturier Gabon SARL',
        legalForm: 'SARL',
        nif: 'NIF-2026-9988',
        rccm: 'RCCM-GA-LBV-2026-B-001',
        address: 'Bld Triomphal, Libreville',
        email: 'direction@facturier.ga',
        phone: '+241 01 02 03 04',
        bankName: 'BGFI Bank Gabon',
        bankAgency: 'Agence Centre',
        accountNumber: 'GA21 4000 3000 1234 5678 9012 34',
        swiftCode: 'BGFIGAGLXXX',
        iban: 'GA214000300012345678901234',
        tvaRate: 18,
        tpsRate: 9.5,
        cssRate: 1,
        sessionTimeout: 3600,
        invoicePrefix: 'FAC',
        quotePrefix: 'DEV',
        companyCode: 'GAB',
      };

      const req = new Request('http://localhost/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullSettings),
      });

      const res = await PATCHSettings(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.nif).toBe('NIF-2026-9988');
      expect(data.rccm).toBe('RCCM-GA-LBV-2026-B-001');

      // Vérification en BDD
      const stored = db.prepare('SELECT nif, rccm FROM settings WHERE id = 1').get() as any;
      expect(stored.nif).toBe('NIF-2026-9988');
      expect(stored.rccm).toBe('RCCM-GA-LBV-2026-B-001');
    });

    it('devrait gérer correctement les paramètres dans le store Zustand (setSettings, updateSettings)', () => {
      const store = useStore.getState();

      store.updateSettings({
        companyName: 'Facturier Zustand',
        nif: 'ZUSTAND-NIF-01',
      });

      expect(useStore.getState().settings.companyName).toBe('Facturier Zustand');
      expect(useStore.getState().settings.nif).toBe('ZUSTAND-NIF-01');
    });
  });
});
