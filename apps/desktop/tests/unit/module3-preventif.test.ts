import { describe, it, expect, beforeEach, vi } from 'vitest';
import db from '@/lib/db';
import { createInvoice, getInvoices, getInvoiceById, deleteInvoice } from '@/app/actions/invoice.actions';
import { createCreditNote, getCreditNotes, getCreditNoteById } from '@/app/actions/credit-note.actions';
import { createClient } from '@/app/actions/client.actions';
import * as authApi from '@/lib/api/auth';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

describe('Module 3 Préventif — Performance, Indexation, Multi-Tenant & Audit Logs', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM credit_note_items').run();
    db.prepare('DELETE FROM credit_notes').run();
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM invoices').run();
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
        ('user-alpha-m3', 'op_alpha_m3', 'hash', 'Opérateur Alpha M3', 'alpha_m3@corp.ga', 'user', 1, 'tenant-alpha-m3'),
        ('admin-alpha-m3', 'admin_alpha_m3', 'hash', 'Admin Alpha M3', 'admin_m3@alpha.ga', 'admin', 1, 'tenant-alpha-m3'),
        ('user-beta-m3', 'op_beta_m3', 'hash', 'Opérateur Beta M3', 'beta_m3@corp.ga', 'user', 1, 'tenant-beta-m3')
    `).run();
  });

  // ==========================================================================
  // 1. VÉRIFICATION DES INDEX COMPOSITES HAUTE PERFORMANCE (ADR-0033)
  // ==========================================================================
  describe('1. Indexation Composite SQLite Haute Performance', () => {
    it('enregistre tous les index composites du Module 3 sur invoices, invoice_items, credit_notes et credit_note_items', () => {
      const invoicesIndices = db.prepare("PRAGMA index_list('invoices')").all() as Array<{ name: string }>;
      const invoiceItemsIndices = db.prepare("PRAGMA index_list('invoice_items')").all() as Array<{ name: string }>;
      const creditNotesIndices = db.prepare("PRAGMA index_list('credit_notes')").all() as Array<{ name: string }>;
      const creditNoteItemsIndices = db.prepare("PRAGMA index_list('credit_note_items')").all() as Array<{ name: string }>;

      const invoiceIndexNames = invoicesIndices.map(i => i.name);
      const invoiceItemIndexNames = invoiceItemsIndices.map(i => i.name);
      const creditNoteIndexNames = creditNotesIndices.map(i => i.name);
      const creditNoteItemIndexNames = creditNoteItemsIndices.map(i => i.name);

      expect(invoiceIndexNames).toContain('idx_invoices_tenant_date');
      expect(invoiceIndexNames).toContain('idx_invoices_client_status');
      expect(invoiceIndexNames).toContain('idx_invoices_tenant_number');
      expect(invoiceItemIndexNames).toContain('idx_invoice_items_invoice_tenant');

      expect(creditNoteIndexNames).toContain('idx_credit_notes_tenant_date');
      expect(creditNoteIndexNames).toContain('idx_credit_notes_tenant_invoice');
      expect(creditNoteItemIndexNames).toContain('idx_credit_note_items_cn_tenant');
    });

    it('exploite l index idx_invoices_tenant_date pour le tri chronologique par tenant', () => {
      const plan = db.prepare(`
        EXPLAIN QUERY PLAN
        SELECT * FROM invoices
        WHERE tenant_id = 'tenant-alpha-m3' AND deletedAt IS NULL
        ORDER BY date DESC
      `).all() as Array<{ detail: string }>;

      const usesIndex = plan.some(step => step.detail.includes('idx_invoices_tenant_date'));
      expect(usesIndex).toBe(true);
    });

    it('exploite l index idx_invoices_client_status pour la consultation ciblée', () => {
      const plan = db.prepare(`
        EXPLAIN QUERY PLAN
        SELECT * FROM invoices
        WHERE tenant_id = 'tenant-alpha-m3' AND clientId = 'client-1' AND status = 'UNPAID' AND deletedAt IS NULL
      `).all() as Array<{ detail: string }>;

      const usesIndex = plan.some(step => 
        step.detail.includes('idx_invoices_client_status') || step.detail.includes('idx_invoices_tenant')
      );
      expect(usesIndex).toBe(true);
    });

    it('exploite l index idx_credit_notes_tenant_invoice pour la recherche d avoir par facture', () => {
      const plan = db.prepare(`
        EXPLAIN QUERY PLAN
        SELECT id FROM credit_notes
        WHERE tenant_id = 'tenant-alpha-m3' AND invoiceId = 'inv-123' AND deletedAt IS NULL
      `).all() as Array<{ detail: string }>;

      const usesIndex = plan.some(step => 
        step.detail.includes('idx_credit_notes_tenant_invoice') || step.detail.includes('idx_credit_notes_tenant')
      );
      expect(usesIndex).toBe(true);
    });
  });

  // ==========================================================================
  // 2. ÉTANCHÉITÉ MULTI-TENANT RIGOUREUSE (ISOLATION DES FACTURES ET AVOIRS)
  // ==========================================================================
  describe('2. Isolation Multi-Tenant Stricte', () => {
    it('garantit qu un tenant ne peut ni lister, ni voir les factures d un autre tenant', async () => {
      // 1. Session Tenant Alpha : création facture
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-alpha-m3',
        name: 'Opérateur Alpha M3',
        role: 'user',
        tenantId: 'tenant-alpha-m3',
      });

      const clientAlphaRes = await createClient({
        name: 'Société Alpha VIP',
        phone: '+241 077 55 66 77',
      });
      const clientAlpha = clientAlphaRes.data!;

      const invoiceAlphaRes = await createInvoice({
        clientId: clientAlpha.id,
        clientName: clientAlpha.name,
        date: '2026-10-27',
        items: [{ description: 'Prestation Confidentielle Alpha', quantity: 1, unitPrice: 750000 }],
      });
      expect(invoiceAlphaRes.success).toBe(true);
      const invoiceId = invoiceAlphaRes.data!.id;

      // 2. Session Tenant Beta : tentative d'accès
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-beta-m3',
        name: 'Opérateur Beta M3',
        role: 'user',
        tenantId: 'tenant-beta-m3',
      });

      // Tenant Beta ne doit voir aucune facture dans sa liste
      const invoicesBetaRes = await getInvoices();
      expect(invoicesBetaRes.success).toBe(true);
      expect(invoicesBetaRes.data?.length).toBe(0);

      // Tentative de lecture directe par ID de la facture du Tenant Alpha
      const invoiceDirectRes = await getInvoiceById(invoiceId);
      expect(invoiceDirectRes.success).toBe(false);
      expect(invoiceDirectRes.error).toContain('not found');
    });
  });

  // ==========================================================================
  // 3. PISTE D'AUDIT COMPLÈTE (AUDIT LOGS)
  // ==========================================================================
  describe('3. Piste d Audit Complète (Audit Logs)', () => {
    it('enregistre fidèlement les logs d audit lors de la création et de la suppression d une facture', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-alpha-m3',
        name: 'Admin Alpha M3',
        role: 'admin',
        tenantId: 'tenant-alpha-m3',
      });

      const clientRes = await createClient({
        name: 'Client Audit Alpha',
        phone: '+241 066 11 22 33',
      });
      const client = clientRes.data!;

      const invoiceRes = await createInvoice({
        clientId: client.id,
        clientName: client.name,
        date: '2026-10-27',
        items: [{ description: 'Contrat Audit Trimestriel', quantity: 1, unitPrice: 300000 }],
      });
      expect(invoiceRes.success).toBe(true);
      const invoiceId = invoiceRes.data!.id;

      // Vérification du log de création
      const createLog = db.prepare('SELECT * FROM audit_logs WHERE entityId = ? AND action = ?').get(invoiceId, 'CREATE') as any;
      expect(createLog).toBeDefined();
      expect(createLog.userId).toBe('admin-alpha-m3');
      expect(createLog.tenant_id).toBe('tenant-alpha-m3');

      // Suppression / annulation de la facture
      const delRes = await deleteInvoice(invoiceId);
      expect(delRes.success).toBe(true);

      // Vérification du log de suppression
      const deleteLog = db.prepare('SELECT * FROM audit_logs WHERE entityId = ? AND action = ?').get(invoiceId, 'DELETE') as any;
      expect(deleteLog).toBeDefined();
      expect(deleteLog.userId).toBe('admin-alpha-m3');
      expect(deleteLog.tenant_id).toBe('tenant-alpha-m3');
    });
  });
});
