import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getNextNumber } from '@/lib/api/numbering';
import { useStore } from '@/lib/store';
import { GET as GETInvoices, POST as POSTInvoice } from '@/app/api/invoices/route';
import { GET as GETInvoiceById, PUT as PUTInvoice, PATCH as PATCHInvoice, DELETE as DELETEInvoice } from '@/app/api/invoices/[id]/route';
import { POST as POSTConvertQuote } from '@/app/api/quotes/convert/route';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
  verifySignature: vi.fn(),
  signSessionCookie: vi.fn(),
}));

describe('🚨 PHASE 6/10 : AUDIT TDD — GESTION DES FACTURES (ACID, CONVERSION, IMMUABILITÉ, RLS) 🚨', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset sequences table for clean deterministic tests
    db.prepare("DELETE FROM sequences WHERE name = 'invoice'").run();
    db.prepare("DELETE FROM sequences WHERE name = 'quote'").run();

    // Reset tables in FK safe order
    db.prepare('DELETE FROM credit_note_items').run();
    db.prepare('DELETE FROM credit_notes').run();
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM quote_items').run();
    db.prepare('DELETE FROM quotes').run();
    db.prepare('DELETE FROM clients').run();
    db.prepare('DELETE FROM users').run();

    // Ensure settings table has companyCode 'GAB'
    db.prepare(`
      INSERT OR REPLACE INTO settings (id, companyName, legalForm, nif, rccm, address, email, phone, bankName, bankAgency, accountNumber, swiftCode, iban, tvaRate, tpsRate, cssRate, sessionTimeout, invoicePrefix, quotePrefix, companyCode)
      VALUES (1, 'Letoile', 'SARL', 'NIF123', 'RCCM123', 'Libreville', 'contact@letoile.ga', '01020304', 'BGFI', 'AG1', 'ACC123', 'SWIFT1', 'IBAN1', 18, 9.5, 1, 3600, 'FAC', 'DEV', 'GAB')
    `).run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // SCÉNARIO 1 : ATOMICITÉ DES TRANSACTIONS (ACID)
  // ==========================================================================
  describe('1. Atomicité des Transactions (ACID & Rollback SQLite)', () => {
    it('devrait effectuer un ROLLBACK complet si une erreur survient lors de l’insertion des lignes (aucune facture fantôme en base)', () => {
      // Préparation client & user
      db.prepare(`INSERT INTO users (id, username, password, name, email, role, is_active, created_at) VALUES ('user-op', 'op', 'pass', 'Opérateur', 'op@test.ga', 'user', 1, datetime('now'))`).run();
      db.prepare(`INSERT INTO clients (id, name, email, created_by) VALUES ('client-1', 'Société A', 'a@societe.ga', 'user-op')`).run();

      const initialCount = (db.prepare('SELECT COUNT(*) as count FROM invoices').get() as { count: number }).count;
      expect(initialCount).toBe(0);

      // Simulation d'une transaction ACID qui insère l'entête puis échoue sur une ligne (ex: contrainte ou exception forcée)
      const faultyTransaction = db.transaction(() => {
        const id = 'fac-rollback-test';
        db.prepare(`
          INSERT INTO invoices (
            id, number, clientId, clientName, clientEmail, date,
            subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, 'FAC-999/GAB/2026', 'client-1', 'Société A', 'a@societe.ga', '2026-07-08', 100000, 0, 100000, 18000, 0, 1000, 119000, 'UNPAID', 'user-op');

        // Vérifions qu'au sein de la transaction le header existe temporairement
        const inTxCount = (db.prepare('SELECT COUNT(*) as count FROM invoices WHERE id = ?').get('fac-rollback-test') as { count: number }).count;
        expect(inTxCount).toBe(1);

        // Déclenchons volontairement une erreur lors de l'insertion d'une ligne (ex: violation NOT NULL ou exception)
        throw new Error('Erreur forcée lors de l’insertion de la ligne de facture');
      });

      expect(() => faultyTransaction()).toThrow('Erreur forcée lors de l’insertion de la ligne de facture');

      // ASSERT STRICT : Vérification que le ROLLBACK a annulé l'insertion de l'entête
      const finalCount = (db.prepare('SELECT COUNT(*) as count FROM invoices').get() as { count: number }).count;
      expect(finalCount).toBe(0);
    });

    it('devrait rejeter via Zod et ne pas créer de facture si un prix unitaire ou une quantité est invalide (ex: décimales non permises)', async () => {
      db.prepare(`INSERT INTO users (id, username, password, name, email, role, is_active, created_at) VALUES ('user-op', 'op', 'pass', 'Opérateur', 'op@test.ga', 'user', 1, datetime('now'))`).run();
      db.prepare(`INSERT INTO clients (id, name, email, created_by) VALUES ('client-1', 'Société A', 'a@societe.ga', 'user-op')`).run();

      vi.mocked(getSession).mockResolvedValue({
        userId: 'user-op',
        role: 'user',
        username: 'op',
        expiresAt: Date.now() + 3600000,
      });

      const payload = {
        clientId: 'client-1',
        clientName: 'Société A',
        clientEmail: 'a@societe.ga',
        date: '2026-07-08',
        discount: 0,
        items: [
          { description: 'Prestation invalide', quantity: 1, unitPrice: 50000.75 }, // Décimale interdite par Zod (.int())
        ],
      };

      const req = new Request('http://localhost/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await POSTInvoice(req);
      expect(res.status).toBe(400);

      const dbCount = (db.prepare('SELECT COUNT(*) as count FROM invoices').get() as { count: number }).count;
      expect(dbCount).toBe(0);
    });
  });

  // ==========================================================================
  // SCÉNARIO 2 : CONVERSION DEVIS -> FACTURE
  // ==========================================================================
  describe('2. Conversion Devis -> Facture (Intégrité XAF & Transition CONVERTI)', () => {
    it('devrait convertir un devis en facture avec les mêmes montants XAF et passer le devis en CONVERTI', async () => {
      db.prepare(`INSERT INTO users (id, username, password, name, email, role, is_active, created_at) VALUES ('user-op', 'op', 'pass', 'Opérateur', 'op@test.ga', 'user', 1, datetime('now'))`).run();
      db.prepare(`INSERT INTO clients (id, name, email, created_by) VALUES ('client-1', 'Client Devis', 'devis@test.ga', 'user-op')`).run();

      // Devis source au statut EN_ATTENTE
      db.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by)
        VALUES ('quote-src', 'DEV-001/GAB/2026', 'client-1', 'Client Devis', 'devis@test.ga', '2026-07-01', 200000, 0, 200000, 36000, 0, 2000, 238000, 'EN_ATTENTE', 'user-op')
      `).run();

      db.prepare(`
        INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
        VALUES ('item-src-1', 'quote-src', 'Consultation', 2, 100000, 200000)
      `).run();

      vi.mocked(getSession).mockResolvedValue({
        userId: 'user-op',
        role: 'user',
        username: 'op',
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('http://localhost/api/quotes/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: 'quote-src' }),
      });

      const res = await POSTConvertQuote(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.invoiceId).toBeDefined();
      expect(data.invoiceNumber).toContain('FAC-');

      // Vérification que la facture en BDD a exactement les mêmes montants XAF
      const createdInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(data.invoiceId) as any;
      expect(createdInvoice.subtotal).toBe(200000);
      expect(createdInvoice.tvaAmount).toBe(36000);
      expect(createdInvoice.cssAmount).toBe(2000);
      expect(createdInvoice.total).toBe(238000);
      expect(createdInvoice.quoteId).toBe('quote-src');
      expect(createdInvoice.created_by).toBe('user-op');

      // Vérification que le devis source est passé en CONVERTI
      const updatedQuote = db.prepare('SELECT status FROM quotes WHERE id = ?').get('quote-src') as { status: string };
      expect(updatedQuote.status).toBe('CONVERTI');
    });

    it('devrait interdire la double conversion d’un devis déjà CONVERTI', async () => {
      db.prepare(`INSERT INTO users (id, username, password, name, email, role, is_active, created_at) VALUES ('user-op', 'op', 'pass', 'Opérateur', 'op@test.ga', 'user', 1, datetime('now'))`).run();
      db.prepare(`INSERT INTO clients (id, name, email, created_by) VALUES ('client-1', 'Client Devis', 'devis@test.ga', 'user-op')`).run();

      db.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by)
        VALUES ('quote-already-converted', 'DEV-002/GAB/2026', 'client-1', 'Client Devis', 'devis@test.ga', '2026-07-01', 100000, 0, 100000, 18000, 0, 1000, 119000, 'CONVERTI', 'user-op')
      `).run();

      vi.mocked(getSession).mockResolvedValue({
        userId: 'user-op',
        role: 'user',
        username: 'op',
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('http://localhost/api/quotes/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: 'quote-already-converted' }),
      });

      const res = await POSTConvertQuote(req);
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // SCÉNARIO 3 : IMMUABILITÉ LÉGALE & SOFT DELETE
  // ==========================================================================
  describe('3. Immuabilité Légale (Blocage PUT/PATCH) & Soft Delete Comptable', () => {
    it('devrait interdire strictement toute modification de facture via PUT ou PATCH (Erreur 405 Method Not Allowed)', async () => {
      const putRes = await PUTInvoice();
      const patchRes = await PATCHInvoice();

      expect(putRes.status).toBe(405);
      expect(patchRes.status).toBe(405);

      const putData = await putRes.json();
      expect(putData.error).toContain('Une facture générée est strictement immuable');
    });

    it('devrait effectuer un Soft Delete strict via DELETE sans jamais effacer la trace comptable physique SQLite', async () => {
      db.prepare(`INSERT INTO users (id, username, password, name, email, role, is_active, created_at) VALUES ('admin-user', 'admin', 'pass', 'Admin', 'admin@test.ga', 'admin', 1, datetime('now'))`).run();
      db.prepare(`INSERT INTO clients (id, name, email, created_by) VALUES ('client-1', 'Client', 'c@t.ga', 'admin-user')`).run();

      db.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by)
        VALUES ('fac-soft-delete', 'FAC-001/GAB/2026', 'client-1', 'Client', 'c@t.ga', '2026-07-08', 100000, 0, 100000, 18000, 0, 1000, 119000, 'UNPAID', 'admin-user')
      `).run();

      vi.mocked(getSession).mockResolvedValue({
        userId: 'admin-user',
        role: 'admin',
        username: 'admin',
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('http://localhost/api/invoices/fac-soft-delete', {
        method: 'DELETE',
      });

      const res = await DELETEInvoice(req, { params: Promise.resolve({ id: 'fac-soft-delete' }) });
      expect(res.status).toBe(200);

      // Vérifions que l'enregistrement physique est TOUJOURS en base
      const rawRecord = db.prepare('SELECT * FROM invoices WHERE id = ?').get('fac-soft-delete') as any;
      expect(rawRecord).toBeDefined();
      expect(rawRecord.deletedAt).not.toBeNull();
      expect(rawRecord.status).toBe('cancelled');

      // Vérifions qu'un GET par ID retourne 404 (car deletedAt n'est pas nul)
      const getRes = await GETInvoiceById(
        new Request('http://localhost/api/invoices/fac-soft-delete'),
        { params: Promise.resolve({ id: 'fac-soft-delete' }) }
      );
      expect(getRes.status).toBe(404);
    });
  });

  // ==========================================================================
  // SCÉNARIO 4 : ISOLEMENT RLS & ÉTANCHÉITÉ ZUSTAND
  // ==========================================================================
  describe('4. Isolement RLS (API) & Étanchéité du Store Zustand', () => {
    it('devrait interdire à User A de consulter les factures appartenant à User B via GET /api/invoices/[id]', async () => {
      db.prepare(`INSERT INTO users (id, username, password, name, email, role, is_active, created_at) VALUES ('user-a', 'usera', 'pass', 'User A', 'a@test.ga', 'user', 1, datetime('now'))`).run();
      db.prepare(`INSERT INTO users (id, username, password, name, email, role, is_active, created_at) VALUES ('user-b', 'userb', 'pass', 'User B', 'b@test.ga', 'user', 1, datetime('now'))`).run();
      db.prepare(`INSERT INTO clients (id, name, email, created_by) VALUES ('c1', 'Société B', 'b@soc.ga', 'user-b')`).run();

      // Facture appartenant à User B
      db.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by)
        VALUES ('fac-user-b', 'FAC-005/GAB/2026', 'c1', 'Société B', 'b@soc.ga', '2026-07-08', 100000, 0, 100000, 18000, 0, 1000, 119000, 'UNPAID', 'user-b')
      `).run();

      // Session en tant que User A
      vi.mocked(getSession).mockResolvedValue({
        userId: 'user-a',
        role: 'user',
        username: 'usera',
        expiresAt: Date.now() + 3600000,
      });

      // 1. GET /api/invoices/[id] doit retourner 403 Forbidden pour User A
      const getRes = await GETInvoiceById(
        new Request('http://localhost/api/invoices/fac-user-b'),
        { params: Promise.resolve({ id: 'fac-user-b' }) }
      );
      expect(getRes.status).toBe(403);

      // 2. GET /api/invoices ne doit lister que les factures de User A (donc 0 ici)
      const listRes = await GETInvoices();
      const listData = await listRes.json();
      expect(Array.isArray(listData)).toBe(true);
      expect(listData.length).toBe(0);
    });

    it('devrait gérer l’ajout et la suppression via des actions atomiques pures sans Stale Closure dans Zustand', () => {
      const store = useStore.getState();

      const inv1 = {
        id: 'fac-store-1',
        number: 'FAC-100/GAB/2026',
        clientId: 'c1',
        clientName: 'Client 1',
        clientEmail: 'c1@test.ga',
        date: '2026-07-08',
        subtotal: 100000,
        discount: 0,
        taxBase: 100000,
        tvaAmount: 18000,
        cssAmount: 1000,
        total: 119000,
        status: 'pending' as const,
        items: [],
        payments: [],
        createdAt: '2026-07-08',
      };

      store.addInvoice(inv1);
      expect(useStore.getState().invoices).toHaveLength(1);
      expect(useStore.getState().invoices[0].id).toBe('fac-store-1');

      store.updateInvoice('fac-store-1', { status: 'paid' as any });
      expect(useStore.getState().invoices[0].status).toBe('paid');

      store.removeInvoice('fac-store-1');
      expect(useStore.getState().invoices).toHaveLength(0);
    });
  });
});
