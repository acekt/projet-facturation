import { describe, it, expect, beforeEach, vi } from 'vitest';
import db from '@/lib/db';
import { createInvoice, getInvoiceById, getInvoices, deleteInvoice } from '@/app/actions/invoice.actions';
import { createCreditNote, getCreditNotes, getCreditNoteById } from '@/app/actions/credit-note.actions';
import { createClient } from '@/app/actions/client.actions';
import * as authApi from '@/lib/api/auth';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

describe('Module 3 Curatif — Cohérence Métier, Avoirs & Multi-Tenancy', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM credit_note_items').run();
    db.prepare('DELETE FROM credit_notes').run();
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM clients').run();
    db.prepare('DELETE FROM audit_logs').run();

    // Configuration fiscale CEMAC
    db.prepare(`
      INSERT OR REPLACE INTO settings (id, companyName, legalForm, nif, rccm, address, email, phone, bankName, bankAgency, accountNumber, swiftCode, iban, tvaRate, tpsRate, cssRate, sessionTimeout, invoicePrefix, quotePrefix, companyCode)
      VALUES (1, 'Facturier Gabon', 'SARL', 'NIF-GAB', 'RCCM-GAB', 'Libreville', 'contact@gabon.ga', '01020304', 'BGFI', 'AG1', 'ACC123', 'SWIFT1', 'IBAN1', 18, 9.5, 1, 3600, 'FAC', 'DEV', 'GAB')
    `).run();

    // Utilisateurs pour deux tenants distincts
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password, name, email, role, is_active, tenant_id)
      VALUES 
        ('user-tenant-a', 'admin_a', 'hash', 'Admin Tenant A', 'admin@tenanta.ga', 'admin', 1, 'tenant-m3-a'),
        ('user-tenant-b', 'admin_b', 'hash', 'Admin Tenant B', 'admin@tenantb.ga', 'admin', 1, 'tenant-m3-b')
    `).run();
  });

  // ==========================================================================
  // 1. ISOLATION MULTI-TENANT STRICTE (INVOICES & CREDIT NOTES)
  // ==========================================================================
  describe('1. Isolation Multi-Tenant', () => {
    it('isole strictement les factures et avoirs entre Tenant A et Tenant B', async () => {
      // 1. Session Tenant A : création client et facture
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-tenant-a',
        name: 'Admin Tenant A',
        role: 'admin',
        tenantId: 'tenant-m3-a',
      });

      const clientA = (await createClient({
        name: 'Client Exclusif Tenant A',
        phone: '+241 077 00 11 22',
      })).data!;

      const invoiceA = (await createInvoice({
        clientId: clientA.id,
        clientName: clientA.name,
        date: '2026-10-27',
        items: [{ description: 'Prestation Sécurisée Tenant A', quantity: 2, unitPrice: 200000 }],
      })).data!;

      expect(invoiceA.id).toBeDefined();

      // Suppression pour générer l'avoir fiscal
      const delRes = await deleteInvoice(invoiceA.id);
      expect(delRes.success).toBe(true);

      const creditNotesA = await getCreditNotes();
      expect(creditNotesA.success).toBe(true);
      expect(creditNotesA.data?.length).toBe(1);
      expect(creditNotesA.data?.[0].clientName).toBe('Client Exclusif Tenant A');

      // 2. Session Tenant B : tentative d'accès aux données du Tenant A
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-tenant-b',
        name: 'Admin Tenant B',
        role: 'admin',
        tenantId: 'tenant-m3-b',
      });

      // Tenant B ne doit voir aucune facture de Tenant A
      const invoicesB = await getInvoices();
      expect(invoicesB.success).toBe(true);
      expect(invoicesB.data?.length).toBe(0);

      // Tenant B ne doit voir aucun avoir de Tenant A
      const creditNotesB = await getCreditNotes();
      expect(creditNotesB.success).toBe(true);
      expect(creditNotesB.data?.length).toBe(0);

      // Tentative d'accès direct par ID
      const directInvoice = await getInvoiceById(invoiceA.id);
      expect(directInvoice.success).toBe(false);
      expect(directInvoice.error).toContain('not found');

      const directCN = await getCreditNoteById(creditNotesA.data![0].id);
      expect(directCN.success).toBe(false);
      expect(directCN.error).toContain('not found');
    });
  });

  // ==========================================================================
  // 2. CONVERSION FISCALE EXACTE & AUDIT LOG LORS DE L'ANNULATION
  // ==========================================================================
  describe('2. Avoirs & Traçabilité Fiscale', () => {
    it('conserve rigoureusement la décomposition fiscale et enregistre l audit log', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-tenant-a',
        name: 'Admin Tenant A',
        role: 'admin',
        tenantId: 'tenant-m3-a',
      });

      const client = (await createClient({
        name: 'Société Minière de Bakoumba',
        phone: '+241 062 33 44 55',
      })).data!;

      const invoiceRes = await createInvoice({
        clientId: client.id,
        clientName: client.name,
        date: '2026-10-27',
        items: [
          { description: 'Étude géologique', quantity: 1, unitPrice: 1000000 },
        ],
      });
      expect(invoiceRes.success).toBe(true);
      const invoice = invoiceRes.data!;

      // Lecture de la facture en base avant suppression
      const invoiceInDb = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id) as any;

      // Annulation de la facture
      const cancelRes = await deleteInvoice(invoice.id);
      expect(cancelRes.success).toBe(true);

      // Vérification de l'avoir en base de données
      const creditNoteInDb = db.prepare('SELECT * FROM credit_notes WHERE invoiceId = ?').get(invoice.id) as any;
      expect(creditNoteInDb).toBeDefined();
      expect(creditNoteInDb.subtotal).toBe(1000000);
      expect(creditNoteInDb.taxBase).toBe(invoiceInDb.taxBase);
      expect(creditNoteInDb.tvaAmount).toBe(invoiceInDb.tvaAmount);
      expect(creditNoteInDb.tpsAmount).toBe(invoiceInDb.tpsAmount);
      expect(creditNoteInDb.cssAmount).toBe(invoiceInDb.cssAmount);
      expect(creditNoteInDb.total).toBe(invoiceInDb.total);

      // Vérification du journal d'audit
      const auditLog = db.prepare('SELECT * FROM audit_logs WHERE entityId = ? AND action = ?').get(invoice.id, 'DELETE') as any;
      expect(auditLog).toBeDefined();
      expect(auditLog.userId).toBe('user-tenant-a');
      expect(auditLog.tenant_id).toBe('tenant-m3-a');
    });
  });
});
