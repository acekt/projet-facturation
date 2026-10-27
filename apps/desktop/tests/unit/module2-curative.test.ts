import { describe, it, expect, beforeEach, vi } from 'vitest';
import db from '@/lib/db';
import { createQuote, updateQuote, deleteQuote, convertQuoteToInvoice, updateQuoteStatus } from '@/app/actions/quote.actions';
import { createClient } from '@/app/actions/client.actions';
import { validateQuoteStatusTransition, computeQuoteStatus } from '@/lib/api/quote-logic';
import * as authApi from '@/lib/api/auth';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

describe('Module 2 Curatif — Stabilité, Verrouillage & Machine à États des Devis', () => {
  beforeEach(() => {
    // Nettoyage des tables dans l'ordre des dépendances
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM quote_items').run();
    db.prepare('DELETE FROM quotes').run();
    db.prepare('DELETE FROM clients').run();
    db.prepare('DELETE FROM audit_logs').run();

    // Configuration des paramètres d'entreprise
    db.prepare(`
      INSERT OR REPLACE INTO settings (id, companyName, legalForm, nif, rccm, address, email, phone, bankName, bankAgency, accountNumber, swiftCode, iban, tvaRate, tpsRate, cssRate, sessionTimeout, invoicePrefix, quotePrefix, companyCode)
      VALUES (1, 'Facturier Gabon', 'SARL', 'NIF-12345', 'RCCM-67890', 'Libreville', 'contact@facturier.ga', '01020304', 'BGFI', 'AG1', 'ACC123', 'SWIFT1', 'IBAN1', 18, 9.5, 1, 3600, 'FAC', 'DEV', 'GAB')
    `).run();

    // Utilisateurs de test
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password, name, email, role, is_active, tenant_id)
      VALUES 
        ('user-admin-1', 'admin_curatif', 'hash', 'Admin Curatif', 'admin@curatif.ga', 'admin', 1, 'tenant-curative-test'),
        ('user-op-1', 'op_curatif', 'hash', 'Opérateur Curatif', 'op@curatif.ga', 'user', 1, 'tenant-curative-test')
    `).run();
  });

  // ==========================================================================
  // 1. VERROUILLAGE ÉTANCHE DES DEVIS CONVERTIS EN FACTURE
  // ==========================================================================
  describe('1. Verrouillage Absolu des Devis Convertis', () => {
    it('bloque formellement toute modification (update) d un devis converti', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-admin-1',
        name: 'Admin Curatif',
        role: 'admin',
        tenantId: 'tenant-curative-test',
      });

      const clientRes = await createClient({ name: 'Client Entreprise A', phone: '+241 01 23 45 67' });
      const client = clientRes.data!;

      const quoteRes = await createQuote({
        clientId: client.id,
        clientName: client.name,
        date: '2026-10-27',
        discount: 0,
        items: [{ description: 'Prestation Réseau', quantity: 1, unitPrice: 100000 }],
      });
      const quoteId = quoteRes.data!.id;

      // Conversion du devis en facture
      const convertRes = await convertQuoteToInvoice(quoteId);
      expect(convertRes.success).toBe(true);

      // Tentative de modification du devis converti
      const updateRes = await updateQuote(quoteId, {
        clientId: client.id,
        clientName: client.name,
        date: '2026-10-27',
        discount: 5000,
        items: [{ description: 'Prestation Réseau Modifiée', quantity: 2, unitPrice: 100000 }],
      });

      expect(updateRes.success).toBe(false);
      expect(updateRes.error).toContain('Impossible de modifier un devis déjà converti');
    });

    it('bloque formellement toute suppression (delete) d un devis converti', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-admin-1',
        name: 'Admin Curatif',
        role: 'admin',
        tenantId: 'tenant-curative-test',
      });

      const clientRes = await createClient({ name: 'Client Entreprise B', phone: '+241 01 23 45 68' });
      const client = clientRes.data!;

      const quoteRes = await createQuote({
        clientId: client.id,
        clientName: client.name,
        date: '2026-10-27',
        discount: 0,
        items: [{ description: 'Installation Serveur', quantity: 1, unitPrice: 200000 }],
      });
      const quoteId = quoteRes.data!.id;

      await convertQuoteToInvoice(quoteId);

      // Tentative de suppression du devis converti
      const deleteRes = await deleteQuote(quoteId);
      expect(deleteRes.success).toBe(false);
      expect(deleteRes.error).toContain('Impossible de supprimer un devis déjà converti');
    });

    it('empêche la double-conversion concurrente d un devis déjà converti (Idempotence)', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-admin-1',
        name: 'Admin Curatif',
        role: 'admin',
        tenantId: 'tenant-curative-test',
      });

      const clientRes = await createClient({ name: 'Client Entreprise C', phone: '+241 01 23 45 69' });
      const client = clientRes.data!;

      const quoteRes = await createQuote({
        clientId: client.id,
        clientName: client.name,
        date: '2026-10-27',
        discount: 0,
        items: [{ description: 'Développement Web', quantity: 1, unitPrice: 500000 }],
      });
      const quoteId = quoteRes.data!.id;

      // Première conversion réussie
      const firstConvert = await convertQuoteToInvoice(quoteId);
      expect(firstConvert.success).toBe(true);

      // Deuxième tentative immédiate rejetée
      const secondConvert = await convertQuoteToInvoice(quoteId);
      expect(secondConvert.success).toBe(false);
      expect(secondConvert.error).toContain('Quote already converted');
    });
  });

  // ==========================================================================
  // 2. ATOMICITÉ ET INTÉGRITÉ TRANSACTIONNELLE DES LIGNES D'ARTICLES
  // ==========================================================================
  describe('2. Atomicité SQLite des Lignes d Articles', () => {
    it('remplace de manière atomique l intégralité des lignes lors d un updateQuote', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-op-1',
        name: 'Opérateur Curatif',
        role: 'user',
        tenantId: 'tenant-curative-test',
      });

      const clientRes = await createClient({ name: 'Client D', phone: '+241 077 00 11 22' });
      const client = clientRes.data!;

      const quoteRes = await createQuote({
        clientId: client.id,
        clientName: client.name,
        date: '2026-10-27',
        discount: 0,
        items: [
          { description: 'Ancienne Ligne 1', quantity: 1, unitPrice: 10000 },
          { description: 'Ancienne Ligne 2', quantity: 2, unitPrice: 20000 },
        ],
      });
      const quoteId = quoteRes.data!.id;

      // Vérification initiale : 2 items
      const initialItems = db.prepare('SELECT * FROM quote_items WHERE quoteId = ?').all(quoteId);
      expect(initialItems.length).toBe(2);

      // Mise à jour avec 3 nouvelles lignes
      const updateRes = await updateQuote(quoteId, {
        clientId: client.id,
        clientName: client.name,
        date: '2026-10-27',
        discount: 0,
        items: [
          { description: 'Nouvelle Ligne A', quantity: 1, unitPrice: 30000 },
          { description: 'Nouvelle Ligne B', quantity: 2, unitPrice: 40000 },
          { description: 'Nouvelle Ligne C', quantity: 3, unitPrice: 50000 },
        ],
      });
      expect(updateRes.success).toBe(true);

      // Vérification finale : exactement 3 items et les anciens ont disparu sans orphelins
      const updatedItems = db.prepare('SELECT * FROM quote_items WHERE quoteId = ?').all(quoteId) as any[];
      expect(updatedItems.length).toBe(3);
      expect(updatedItems.some(it => it.description === 'Ancienne Ligne 1')).toBe(false);
      expect(updatedItems.some(it => it.description === 'Nouvelle Ligne A')).toBe(true);
    });
  });

  // ==========================================================================
  // 3. MACHINE À ÉTATS FINIS DES STATUTS ET EXPIRATION TEMPORELLE
  // ==========================================================================
  describe('3. Machine à États Finis & Expiration', () => {
    it('autorise les transitions légitimes et interdit les régressions depuis un état final', () => {
      // Transitions valides depuis EN_ATTENTE
      expect(validateQuoteStatusTransition('EN_ATTENTE', 'ENVOYE')).toBe(true);
      expect(validateQuoteStatusTransition('EN_ATTENTE', 'REFUSE')).toBe(true);
      expect(validateQuoteStatusTransition('EN_ATTENTE', 'CONVERTI')).toBe(true);
      expect(validateQuoteStatusTransition('EN_ATTENTE', 'EXPIRE')).toBe(true);

      // Transitions valides depuis ENVOYE
      expect(validateQuoteStatusTransition('ENVOYE', 'REFUSE')).toBe(true);
      expect(validateQuoteStatusTransition('ENVOYE', 'CONVERTI')).toBe(true);
      expect(validateQuoteStatusTransition('ENVOYE', 'EXPIRE')).toBe(true);

      // États finaux inaltérables
      expect(validateQuoteStatusTransition('CONVERTI', 'EN_ATTENTE')).toBe(false);
      expect(validateQuoteStatusTransition('CONVERTI', 'ENVOYE')).toBe(false);
      expect(validateQuoteStatusTransition('REFUSE', 'EN_ATTENTE')).toBe(false);
      expect(validateQuoteStatusTransition('EXPIRE', 'EN_ATTENTE')).toBe(false);
    });

    it('calcule correctement l expiration temporelle d un devis après 30 jours', () => {
      const today = new Date('2026-10-27');
      const oldDate = '2026-08-01'; // > 60 jours avant

      // Un devis EN_ATTENTE ancien devient EXPIRE
      const expiredStatus = computeQuoteStatus({ date: oldDate, status: 'EN_ATTENTE', validityDays: 30 }, today);
      expect(expiredStatus).toBe('EXPIRE');

      // Un devis CONVERTI ancien RESTE CONVERTI (l'état comptable est scellé)
      const convertedStatus = computeQuoteStatus({ date: oldDate, status: 'CONVERTI', validityDays: 30 }, today);
      expect(convertedStatus).toBe('CONVERTI');
    });
  });
});
