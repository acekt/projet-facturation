import { describe, it, expect, beforeEach, vi } from 'vitest';
import db from '@/lib/db';
import { createQuote, updateQuote, deleteQuote, getQuotes, getQuoteById, convertQuoteToInvoice } from '@/app/actions/quote.actions';
import { createClient } from '@/app/actions/client.actions';
import * as authApi from '@/lib/api/auth';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

describe('Module 2 Préventif — Performance, Indexation, Multi-Tenant & Audit Logs', () => {
  beforeEach(() => {
    // Purge ordonnée des tables
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM quote_items').run();
    db.prepare('DELETE FROM quotes').run();
    db.prepare('DELETE FROM clients').run();
    db.prepare('DELETE FROM audit_logs').run();

    // Configuration des paramètres société
    db.prepare(`
      INSERT OR REPLACE INTO settings (id, companyName, legalForm, nif, rccm, address, email, phone, bankName, bankAgency, accountNumber, swiftCode, iban, tvaRate, tpsRate, cssRate, sessionTimeout, invoicePrefix, quotePrefix, companyCode)
      VALUES (1, 'Facturier Gabon', 'SARL', 'NIF-12345', 'RCCM-67890', 'Libreville', 'contact@facturier.ga', '01020304', 'BGFI', 'AG1', 'ACC123', 'SWIFT1', 'IBAN1', 18, 9.5, 1, 3600, 'FAC', 'DEV', 'GAB')
    `).run();

    // Utilisateurs pour Tenant Alpha et Tenant Beta
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password, name, email, role, is_active, tenant_id)
      VALUES 
        ('user-alpha', 'op_alpha', 'hash', 'Opérateur Alpha', 'alpha@corp.ga', 'user', 1, 'tenant-alpha'),
        ('admin-alpha', 'admin_alpha', 'hash', 'Admin Alpha', 'admin@alpha.ga', 'admin', 1, 'tenant-alpha'),
        ('user-beta', 'op_beta', 'hash', 'Opérateur Beta', 'beta@corp.ga', 'user', 1, 'tenant-beta')
    `).run();
  });

  // ==========================================================================
  // 1. VÉRIFICATION DES INDEX COMPOSITES HAUTE PERFORMANCE (ADR-0032)
  // ==========================================================================
  describe('1. Indexation Composite SQLite Haute Performance', () => {
    it('enregistre tous les index composites du Module 2 sur quotes et quote_items', () => {
      const quotesIndices = db.prepare("PRAGMA index_list('quotes')").all() as Array<{ name: string }>;
      const quoteItemsIndices = db.prepare("PRAGMA index_list('quote_items')").all() as Array<{ name: string }>;

      const quoteIndexNames = quotesIndices.map(i => i.name);
      const quoteItemIndexNames = quoteItemsIndices.map(i => i.name);

      expect(quoteIndexNames).toContain('idx_quotes_tenant_date');
      expect(quoteIndexNames).toContain('idx_quotes_tenant_client');
      expect(quoteIndexNames).toContain('idx_quotes_tenant_status');
      expect(quoteIndexNames).toContain('idx_quotes_tenant_number');
      expect(quoteItemIndexNames).toContain('idx_quote_items_quote_tenant');
    });

    it('exploite l index idx_quotes_tenant_date pour le tri chronologique par tenant', () => {
      const plan = db.prepare(`
        EXPLAIN QUERY PLAN
        SELECT * FROM quotes
        WHERE tenant_id = 'tenant-alpha' AND deletedAt IS NULL
        ORDER BY date DESC
      `).all() as Array<{ detail: string }>;

      const usesIndex = plan.some(step => step.detail.includes('idx_quotes_tenant_date'));
      expect(usesIndex).toBe(true);
    });

    it('exploite l index idx_quotes_tenant_status pour le filtrage par statut', () => {
      const plan = db.prepare(`
        EXPLAIN QUERY PLAN
        SELECT * FROM quotes
        WHERE tenant_id = 'tenant-alpha' AND status = 'EN_ATTENTE' AND deletedAt IS NULL
      `).all() as Array<{ detail: string }>;

      const usesIndex = plan.some(step => 
        step.detail.includes('idx_quotes_tenant_status') || step.detail.includes('idx_quotes_tenant')
      );
      expect(usesIndex).toBe(true);
    });
  });

  // ==========================================================================
  // 2. ÉTANCHÉITÉ MULTI-TENANT RIGOUREUSE (ISOLATION DES DONNÉES)
  // ==========================================================================
  describe('2. Isolation Multi-Tenant Stricte', () => {
    it('garantit qu un tenant ne peut ni lister, ni voir, ni modifier les devis d un autre tenant', async () => {
      // 1. Session Tenant Alpha : création d'un devis
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-alpha',
        name: 'Opérateur Alpha',
        role: 'user',
        tenantId: 'tenant-alpha',
      });

      const clientAlphaRes = await createClient({ name: 'Client Confidentiel Alpha', phone: '+241 077 11 22 33' });
      const clientAlpha = clientAlphaRes.data!;

      const quoteAlphaRes = await createQuote({
        clientId: clientAlpha.id,
        clientName: clientAlpha.name,
        date: '2026-10-27',
        discount: 0,
        items: [{ description: 'Conseil Stratégique Alpha', quantity: 1, unitPrice: 1500000 }],
      });
      expect(quoteAlphaRes.success).toBe(true);
      const quoteAlphaId = quoteAlphaRes.data!.id;

      // 2. Bascule vers la session Tenant Beta
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-beta',
        name: 'Opérateur Beta',
        role: 'user',
        tenantId: 'tenant-beta',
      });

      // A. Tenant Beta liste ses devis -> Doit être vide
      const listBeta = await getQuotes();
      expect(listBeta.success).toBe(true);
      expect(listBeta.data?.length).toBe(0);

      // B. Tenant Beta tente de lire le devis de Tenant Alpha par son ID -> Rejet
      const readBeta = await getQuoteById(quoteAlphaId);
      expect(readBeta.success).toBe(false);

      // C. Tenant Beta tente de modifier le devis de Tenant Alpha -> Rejet
      const updateBeta = await updateQuote(quoteAlphaId, {
        clientId: clientAlpha.id,
        clientName: 'Hacked Name',
        date: '2026-10-27',
        discount: 0,
        items: [{ description: 'Hacked item', quantity: 1, unitPrice: 100 }],
      });
      expect(updateBeta.success).toBe(false);

      // D. Tenant Beta tente de supprimer le devis de Tenant Alpha -> Rejet
      const deleteBeta = await deleteQuote(quoteAlphaId);
      expect(deleteBeta.success).toBe(false);

      // Vérification en base : le devis de Tenant Alpha est resté intact
      const quoteInDb = db.prepare('SELECT clientName, deletedAt FROM quotes WHERE id = ?').get(quoteAlphaId) as any;
      expect(quoteInDb.clientName).toBe('Client Confidentiel Alpha');
      expect(quoteInDb.deletedAt).toBeNull();
    });
  });

  // ==========================================================================
  // 3. PISTE D'AUDIT COMPLÈTE ET TRAÇABILITÉ (audit_logs)
  // ==========================================================================
  describe('3. Piste d Audit Complète & Traçabilité', () => {
    it('enregistre des entrées d audit fidèles lors de la création, modification et suppression d un devis', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-alpha',
        name: 'Admin Alpha',
        role: 'admin',
        tenantId: 'tenant-alpha',
      });

      const clientRes = await createClient({ name: 'Client Audit Test', phone: '+241 066 55 44 33' });
      const client = clientRes.data!;

      // 1. Création -> Audit CREATE
      const quoteRes = await createQuote({
        clientId: client.id,
        clientName: client.name,
        date: '2026-10-27',
        discount: 0,
        items: [{ description: 'Service Audit', quantity: 1, unitPrice: 75000 }],
      });
      const quoteId = quoteRes.data!.id;

      const createAudit = db.prepare(`
        SELECT * FROM audit_logs 
        WHERE entityId = ? AND action = 'CREATE' AND entityType = 'quote'
      `).get(quoteId) as any;
      expect(createAudit).toBeDefined();
      expect(createAudit.userId).toBe('admin-alpha');
      expect(createAudit.tenant_id).toBe('tenant-alpha');

      // 2. Modification -> Audit UPDATE
      await updateQuote(quoteId, {
        clientId: client.id,
        clientName: client.name,
        date: '2026-10-27',
        discount: 5000,
        items: [{ description: 'Service Audit Révisé', quantity: 1, unitPrice: 75000 }],
      });

      const updateAudit = db.prepare(`
        SELECT * FROM audit_logs 
        WHERE entityId = ? AND action = 'UPDATE' AND entityType = 'quote'
      `).get(quoteId) as any;
      expect(updateAudit).toBeDefined();
      expect(updateAudit.tenant_id).toBe('tenant-alpha');

      // 3. Suppression -> Audit DELETE
      await deleteQuote(quoteId);

      const deleteAudit = db.prepare(`
        SELECT * FROM audit_logs 
        WHERE entityId = ? AND action = 'DELETE' AND entityType = 'quote'
      `).get(quoteId) as any;
      expect(deleteAudit).toBeDefined();
      expect(deleteAudit.tenant_id).toBe('tenant-alpha');
    });
  });
});
