import { describe, it, expect, beforeEach, vi } from 'vitest';
import db from '@/lib/db';
import { createQuote, updateQuote, getQuotes, getQuoteById } from '@/app/actions/quote.actions';
import { createClient } from '@/app/actions/client.actions';
import { quoteSchema, quoteItemSchema } from '@/lib/validations';
import * as authApi from '@/lib/api/auth';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

describe('Module 2 Correctif — Gestion des Devis (Quotes)', () => {
  beforeEach(() => {
    // Purge des données de test
    db.prepare('DELETE FROM quote_items').run();
    db.prepare('DELETE FROM quotes').run();
    db.prepare('DELETE FROM clients').run();
    db.prepare('DELETE FROM audit_logs').run();

    // Insertion des paramètres fiscaux (TVA, CSS, TPS)
    db.prepare(`
      INSERT OR REPLACE INTO settings (id, companyName, legalForm, nif, rccm, address, email, phone, bankName, bankAgency, accountNumber, swiftCode, iban, tvaRate, tpsRate, cssRate, sessionTimeout, invoicePrefix, quotePrefix, companyCode)
      VALUES (1, 'Facturier Test', 'SARL', 'NIF123', 'RCCM123', 'Libreville', 'contact@facturier.ga', '01020304', 'BGFI', 'AG1', 'ACC123', 'SWIFT1', 'IBAN1', 18, 9.5, 1, 3600, 'FAC', 'DEV', 'GAB')
    `).run();

    // Insertion d'un utilisateur admin et d'un opérateur
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password, name, email, role, is_active, tenant_id)
      VALUES 
        ('user-admin-1', 'admin_devis', 'hash', 'Admin Devis', 'admin@devis.ga', 'admin', 1, 'tenant-quotes-test'),
        ('user-op-1', 'op_devis', 'hash', 'Opérateur Devis', 'op@devis.ga', 'user', 1, 'tenant-quotes-test')
    `).run();
  });

  // ==========================================================================
  // 1. TOLÉRANCE AUX CLIENTS SANS ADRESSE EMAIL (Walk-In / Comptoir)
  // ==========================================================================
  describe('1. Clients sans Email & Devis Opérationnels', () => {
    it('permet de créer un devis pour un client sans adresse email (email: null ou "")', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-op-1',
        name: 'Opérateur Devis',
        role: 'user',
        tenantId: 'tenant-quotes-test',
      });

      // 1. Création d'un client sans email
      const clientRes = await createClient({
        name: 'Client Comptoir Gabon SARL',
        phone: '+241 074 12 34 56',
        address: 'Quartier Louis, Libreville',
      });
      expect(clientRes.success).toBe(true);
      const client = clientRes.data!;
      expect(client.email).toBeNull();

      // 2. Création d'un devis pour ce client avec clientEmail = null
      const quoteRes = await createQuote({
        clientId: client.id,
        clientName: client.name,
        clientEmail: null,
        date: '2026-10-27',
        discount: 0,
        items: [
          {
            description: 'Audit et diagnostic réseau informatique',
            quantity: 1,
            unitPrice: 250000,
          },
        ],
      });

      expect(quoteRes.success).toBe(true);
      expect(quoteRes.data?.number).toBeDefined();

      // 3. Vérification en base de données
      const quoteInDb = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteRes.data!.id) as any;
      expect(quoteInDb.clientId).toBe(client.id);
      expect(quoteInDb.clientName).toBe('Client Comptoir Gabon SARL');
      expect(quoteInDb.clientEmail).toBeNull();
      expect(quoteInDb.subtotal).toBe(250000);
      expect(quoteInDb.total).toBe(321938); // 250 000 HT + CSS (1%) + TPS (9.5%) + TVA (18%)
    });

    it('permet de mettre à jour un devis avec un email client null sans rejet de validation', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-op-1',
        name: 'Opérateur Devis',
        role: 'user',
        tenantId: 'tenant-quotes-test',
      });

      const clientRes = await createClient({
        name: 'Client Particulier',
        phone: '+241 065 99 88 77',
      });
      const client = clientRes.data!;

      const quoteRes = await createQuote({
        clientId: client.id,
        clientName: client.name,
        clientEmail: '',
        date: '2026-10-27',
        discount: 0,
        items: [
          {
            description: 'Assistance technique sur site',
            quantity: 2,
            unitPrice: 50000,
          },
        ],
      });
      expect(quoteRes.success).toBe(true);

      // Mise à jour du devis avec ajout d'une remise et validUntil
      const updateRes = await updateQuote(quoteRes.data!.id, {
        clientId: client.id,
        clientName: client.name,
        clientEmail: null,
        date: '2026-10-27',
        validUntil: '2026-11-27',
        discount: 10000,
        subject: 'Proposition d assistance',
        items: [
          {
            description: 'Assistance technique sur site (forfait jour)',
            quantity: 3,
            unitPrice: 50000,
          },
        ],
      });

      expect(updateRes.success).toBe(true);

      const updatedInDb = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteRes.data!.id) as any;
      expect(updatedInDb.subtotal).toBe(150000);
      expect(updatedInDb.discount).toBe(10000);
      expect(updatedInDb.clientEmail).toBeNull();
      expect(updatedInDb.total).toBe(180285); // 140 000 Net HT + taxes DGI
      expect(updatedInDb.validUntil).toBe('2026-11-27');
    });
  });

  // ==========================================================================
  // 2. GESTION DES DATES DE VALIDITÉ (validUntil Optionnelle & Nullable)
  // ==========================================================================
  describe('2. Flexibilité de la Date de Validité', () => {
    it('accepte une date de validité vide ("" ou null) dans quoteSchema', () => {
      const validEmptyString = quoteSchema.safeParse({
        clientId: 'client-1',
        clientName: 'Client Test',
        clientEmail: null,
        date: '2026-10-27',
        discount: 0,
        validUntil: '',
        items: [{ description: 'Service Test', quantity: 1, unitPrice: 10000 }],
      });
      expect(validEmptyString.success).toBe(true);

      const validNull = quoteSchema.safeParse({
        clientId: 'client-1',
        clientName: 'Client Test',
        date: '2026-10-27',
        discount: 0,
        validUntil: null,
        items: [{ description: 'Service Test', quantity: 1, unitPrice: 10000 }],
      });
      expect(validNull.success).toBe(true);
    });

    it('rejette un format de date invalide pour validUntil', () => {
      const invalidDate = quoteSchema.safeParse({
        clientId: 'client-1',
        clientName: 'Client Test',
        date: '2026-10-27',
        discount: 0,
        validUntil: 'date-non-valide',
        items: [{ description: 'Service Test', quantity: 1, unitPrice: 10000 }],
      });
      expect(invalidDate.success).toBe(false);
    });
  });

  // ==========================================================================
  // 3. RÈGLE MONÉTAIRE XAF ET VALIDATION DES LIGNES D'ARTICLES
  // ==========================================================================
  describe('3. Règle Monétaire XAF & Validation des Articles', () => {
    it('rejette les articles avec un prix unitaire négatif ou décimal', () => {
      // Prix unitaire négatif
      const negativePrice = quoteItemSchema.safeParse({
        description: 'Article Test',
        quantity: 1,
        unitPrice: -5000,
      });
      expect(negativePrice.success).toBe(false);

      // Prix unitaire avec centimes (interdit en FCFA)
      const decimalPrice = quoteItemSchema.safeParse({
        description: 'Article Test',
        quantity: 1,
        unitPrice: 1250.75,
      });
      expect(decimalPrice.success).toBe(false);

      // Prix entier positif (conforme XAF)
      const validXAF = quoteItemSchema.safeParse({
        description: 'Article Conforme',
        quantity: 2.5, // Les quantités fractionnaires sont autorisées (ex: 2.5 heures)
        unitPrice: 15000,
      });
      expect(validXAF.success).toBe(true);
    });

    it('rejette les articles avec quantité inférieure ou égale à zéro', () => {
      const zeroQty = quoteItemSchema.safeParse({
        description: 'Article Test',
        quantity: 0,
        unitPrice: 10000,
      });
      expect(zeroQty.success).toBe(false);

      const negativeQty = quoteItemSchema.safeParse({
        description: 'Article Test',
        quantity: -1,
        unitPrice: 10000,
      });
      expect(negativeQty.success).toBe(false);
    });

    it('rejette un devis ne contenant aucun article', () => {
      const emptyItems = quoteSchema.safeParse({
        clientId: 'client-1',
        clientName: 'Client Test',
        date: '2026-10-27',
        discount: 0,
        items: [],
      });
      expect(emptyItems.success).toBe(false);
    });
  });
});
