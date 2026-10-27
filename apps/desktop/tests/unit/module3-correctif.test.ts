import { describe, it, expect, beforeEach, vi } from 'vitest';
import db from '@/lib/db';
import { createInvoice, getInvoiceById, getInvoices } from '@/app/actions/invoice.actions';
import { createCreditNote, getCreditNotes, getCreditNoteById } from '@/app/actions/credit-note.actions';
import { createClient } from '@/app/actions/client.actions';
import { invoiceSchema, invoiceItemSchema, creditNoteCreateSchema, creditNoteItemSchema } from '@/lib/validations';
import * as authApi from '@/lib/api/auth';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

describe('Module 3 Correctif — Facturation et Avoirs (Invoices & Credit Notes)', () => {
  beforeEach(() => {
    // Purge ordonnée des tables
    db.prepare('DELETE FROM credit_note_items').run();
    db.prepare('DELETE FROM credit_notes').run();
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM clients').run();
    db.prepare('DELETE FROM audit_logs').run();

    // Insertion des paramètres fiscaux
    db.prepare(`
      INSERT OR REPLACE INTO settings (id, companyName, legalForm, nif, rccm, address, email, phone, bankName, bankAgency, accountNumber, swiftCode, iban, tvaRate, tpsRate, cssRate, sessionTimeout, invoicePrefix, quotePrefix, companyCode)
      VALUES (1, 'Facturier Test', 'SARL', 'NIF123', 'RCCM123', 'Libreville', 'contact@facturier.ga', '01020304', 'BGFI', 'AG1', 'ACC123', 'SWIFT1', 'IBAN1', 18, 9.5, 1, 3600, 'FAC', 'DEV', 'GAB')
    `).run();

    // Insertion d'un utilisateur admin et d'un opérateur
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password, name, email, role, is_active, tenant_id)
      VALUES 
        ('user-admin-m3', 'admin_factures', 'hash', 'Admin Factures', 'admin@factures.ga', 'admin', 1, 'tenant-invoices-test'),
        ('user-op-m3', 'op_factures', 'hash', 'Opérateur Factures', 'op@factures.ga', 'user', 1, 'tenant-invoices-test')
    `).run();
  });

  // ==========================================================================
  // 1. TOLÉRANCE AUX CLIENTS SANS ADRESSE EMAIL (Walk-In / Comptoir)
  // ==========================================================================
  describe('1. Clients sans Email & Factures Opérationnelles', () => {
    it('permet de créer une facture pour un client sans adresse email (email: null ou "")', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-op-m3',
        name: 'Opérateur Factures',
        role: 'user',
        tenantId: 'tenant-invoices-test',
      });

      // 1. Création client sans email
      const clientRes = await createClient({
        name: 'Client Comptoir Akanda',
        phone: '+241 077 11 22 33',
        address: 'Carrefour Château, Akanda',
      });
      expect(clientRes.success).toBe(true);
      const client = clientRes.data!;
      expect(client.email).toBeNull();

      // 2. Création de facture avec clientEmail: null
      const invoiceRes = await createInvoice({
        clientId: client.id,
        clientName: client.name,
        clientEmail: null,
        date: '2026-10-27',
        dueDate: '2026-11-26',
        discount: 0,
        items: [
          {
            description: 'Installation baie de brassage réseau',
            quantity: 1,
            unitPrice: 500000,
          },
        ],
      });

      expect(invoiceRes.success).toBe(true);
      expect(invoiceRes.data?.number).toBeDefined();

      // 3. Vérification en base de données
      const invoiceInDb = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceRes.data!.id) as any;
      expect(invoiceInDb.clientId).toBe(client.id);
      expect(invoiceInDb.clientName).toBe('Client Comptoir Akanda');
      expect(invoiceInDb.clientEmail).toBeNull();
      expect(invoiceInDb.subtotal).toBe(500000);
      expect(invoiceInDb.dueDate).toBe('2026-11-26');
      expect(invoiceInDb.total).toBe(643875); // 500 000 HT + CSS (1%) + TPS (9.5%) + TVA (18%)
    });

    it('génère automatiquement une date d échéance à J+30 si dueDate est omise', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-op-m3',
        name: 'Opérateur Factures',
        role: 'user',
        tenantId: 'tenant-invoices-test',
      });

      const clientRes = await createClient({
        name: 'Entreprise Mandji',
        email: 'mandji@portgentil.ga',
        phone: '+241 01 02 03 04',
      });
      expect(clientRes.success).toBe(true);
      const client = clientRes.data!;

      const invoiceRes = await createInvoice({
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        date: '2026-10-01',
        discount: 0,
        items: [
          {
            description: 'Maintenance préventive parc serveurs',
            quantity: 2,
            unitPrice: 150000,
          },
        ],
      });

      expect(invoiceRes.success).toBe(true);
      const invoiceInDb = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceRes.data!.id) as any;
      expect(invoiceInDb.dueDate).toBe('2026-10-31'); // 2026-10-01 + 30 jours
    });
  });

  // ==========================================================================
  // 2. RÈGLE MONÉTAIRE XAF (PRIX UNITAIRES, REMISES ET TOTAUX EN ENTIERS STRICTS)
  // ==========================================================================
  describe('2. Validation Stricte des Entiers XAF (Factures & Avoirs)', () => {
    it('rejette les prix unitaires avec centimes dans invoiceItemSchema', () => {
      const invalidItem = {
        description: 'Article avec centimes',
        quantity: 1,
        unitPrice: 12500.5,
      };
      const res = invoiceItemSchema.safeParse(invalidItem);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.flatten().fieldErrors.unitPrice?.[0]).toContain('entier');
      }
    });

    it('rejette les prix unitaires avec centimes dans creditNoteItemSchema', () => {
      const invalidCreditItem = {
        description: 'Ligne avoir avec centimes',
        quantity: 1,
        unitPrice: 45000.75,
      };
      const res = creditNoteItemSchema.safeParse(invalidCreditItem);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.flatten().fieldErrors.unitPrice?.[0]).toContain('entier');
      }
    });

    it('accepte les entiers stricts en XAF pour factures et avoirs', () => {
      const validItem = {
        description: 'Licence logicielle annuelle',
        quantity: 3,
        unitPrice: 150000,
      };
      const invoiceItemRes = invoiceItemSchema.safeParse(validItem);
      expect(invoiceItemRes.success).toBe(true);

      const creditItemRes = creditNoteItemSchema.safeParse(validItem);
      expect(creditItemRes.success).toBe(true);
    });

    it('rejette les remises avec centimes décimaux dans invoiceSchema', () => {
      const invalidInvoice = {
        clientId: 'client-1',
        clientName: 'Client Test',
        clientEmail: 'client@test.ga',
        date: '2026-10-27',
        discount: 1500.5, // Interdit en XAF
        items: [
          {
            description: 'Audit',
            quantity: 1,
            unitPrice: 100000,
          },
        ],
      };
      const res = invoiceSchema.safeParse(invalidInvoice);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.flatten().fieldErrors.discount?.[0]).toContain('entier');
      }
    });
  });

  // ==========================================================================
  // 3. AVOIRS (CREDIT NOTES) & VALIDATION STRICTE
  // ==========================================================================
  describe('3. Validation et Cohérence des Avoirs', () => {
    it('permet de créer un avoir valide et annule automatiquement la facture si total >= montant facture', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-admin-m3',
        name: 'Admin Factures',
        role: 'admin',
        tenantId: 'tenant-invoices-test',
      });

      // 1. Client & Facture initiale
      const clientRes = await createClient({
        name: 'Client Avoir Test',
        phone: '+241 077 88 99 00',
      });
      expect(clientRes.success).toBe(true);
      const client = clientRes.data!;

      const invoiceRes = await createInvoice({
        clientId: client.id,
        clientName: client.name,
        date: '2026-10-27',
        discount: 0,
        items: [{ description: 'Prestation Erronée', quantity: 1, unitPrice: 100000 }],
      });
      expect(invoiceRes.success).toBe(true);
      const invoiceId = invoiceRes.data!.id;

      // 2. Création de l'avoir
      const creditNoteRes = await createCreditNote({
        invoiceId,
        reason: 'Facturation erronée suite à annulation client',
        items: [{ description: 'Prestation Erronée', quantity: 1, unitPrice: 100000 }],
      });

      expect(creditNoteRes.success).toBe(true);
      expect(creditNoteRes.data?.number).toBeDefined();

      // 3. Vérification du statut de la facture (marquée cancelled)
      const invoiceUpdated = db.prepare('SELECT status FROM invoices WHERE id = ?').get(invoiceId) as any;
      expect(invoiceUpdated.status).toBe('cancelled');
    });

    it('rejette la création d un avoir si le motif (reason) est vide', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-admin-m3',
        name: 'Admin Factures',
        role: 'admin',
        tenantId: 'tenant-invoices-test',
      });

      const res = await createCreditNote({
        invoiceId: 'inv-123',
        reason: '', // Interdit
        items: [{ description: 'Item', quantity: 1, unitPrice: 50000 }],
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Données invalides');
    });
  });
});
