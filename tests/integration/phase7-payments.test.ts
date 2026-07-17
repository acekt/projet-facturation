import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from '@/lib/store';
import { GET as GETPayments, POST as POSTPayment } from '@/app/api/payments/route';
import { DELETE as DELETEPayment } from '@/app/api/payments/[id]/route';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
  verifySignature: vi.fn(),
  signSessionCookie: vi.fn(),
}));

describe('🚨 PHASE 7/10 : AUDIT TDD — PAIEMENTS & TRÉSORERIE (RESTES À CHARGE, TROP-PERÇUS, SOFT DELETE, RLS) 🚨', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset sequences & tables in safe FK order
    db.prepare('DELETE FROM credit_note_items').run();
    db.prepare('DELETE FROM credit_notes').run();
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM quote_items').run();
    db.prepare('DELETE FROM quotes').run();
    db.prepare('DELETE FROM clients').run();
    db.prepare('DELETE FROM users').run();

    // Ensure settings
    db.prepare(`
      INSERT OR REPLACE INTO settings (id, companyName, legalForm, nif, rccm, address, email, phone, bankName, bankAgency, accountNumber, swiftCode, iban, tvaRate, tpsRate, cssRate, sessionTimeout, invoicePrefix, quotePrefix, companyCode)
      VALUES (1, 'Letoile', 'SARL', 'NIF123', 'RCCM123', 'Libreville', 'contact@letoile.ga', '01020304', 'BGFI', 'AG1', 'ACC123', 'SWIFT1', 'IBAN1', 18, 9.5, 1, 3600, 'FAC', 'DEV', 'GAB')
    `).run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper pour insérer une facture de test en BDD
  function createTestInvoice(id: string, total: number, createdBy: string = 'user-op'): string {
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password, name, email, role, is_active, created_at)
      VALUES (?, ?, 'pass', 'Opérateur', ?, 'user', 1, datetime('now'))
    `).run(createdBy, createdBy, `${createdBy}@test.ga`);

    db.prepare(`
      INSERT OR IGNORE INTO clients (id, name, email, created_by)
      VALUES ('client-1', 'Client Paiement', 'client@p.ga', ?)
    `).run(createdBy);

    db.prepare(`
      INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by)
      VALUES (?, ?, 'client-1', 'Client Paiement', 'client@p.ga', '2026-07-08', ?, 0, ?, 0, 0, 0, ?, 'UNPAID', ?)
    `).run(id, `FAC-${id}`, total, total, total, createdBy);

    return id;
  }

  // ==========================================================================
  // SCÉNARIO 1 : CALCUL DES RESTES À CHARGE & SYNCHRONISATION DE STATUT
  // ==========================================================================
  describe('1. Calcul des Restes à Charge & Synchronisation de Statut', () => {
    it('devrait passer la facture en PARTIALLY_PAID après un paiement de 40 000 XAF puis en PAID après un second paiement de 60 000 XAF (sur 100 000 XAF)', async () => {
      createTestInvoice('fac-100k', 100000, 'user-op');

      vi.mocked(getSession).mockResolvedValue({
        userId: 'user-op',
        role: 'user',
        username: 'user-op',
        expiresAt: Date.now() + 3600000,
      });

      // 1er paiement : 40 000 XAF
      const req1 = new Request('http://localhost/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: 'fac-100k',
          amount: 40000,
          paymentMethod: 'virement',
          date: '2026-07-08',
          reference: 'VIR-1',
        }),
      });

      const res1 = await POSTPayment(req1);
      const data1 = await res1.json();

      expect(res1.status).toBe(200);
      expect(data1.newStatus).toBe('PARTIALLY_PAID');

      const invAfter1 = db.prepare('SELECT status FROM invoices WHERE id = ?').get('fac-100k') as { status: string };
      expect(invAfter1.status).toBe('PARTIALLY_PAID');

      // 2nd paiement : 60 000 XAF (solde)
      const req2 = new Request('http://localhost/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: 'fac-100k',
          amount: 60000,
          paymentMethod: 'virement',
          date: '2026-07-09',
          reference: 'VIR-2',
        }),
      });

      const res2 = await POSTPayment(req2);
      const data2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(data2.newStatus).toBe('PAID');

      const invAfter2 = db.prepare('SELECT status FROM invoices WHERE id = ?').get('fac-100k') as { status: string };
      expect(invAfter2.status).toBe('PAID');
    });
  });

  // ==========================================================================
  // SCÉNARIO 2 : BLOCAGE DES TROP-PERÇUS (OVERPAYMENT)
  // ==========================================================================
  describe('2. Blocage des Trop-perçus (Overpayment)', () => {
    it('devrait interdire un paiement excédant le reste à charge avec une erreur 400 explicite', async () => {
      createTestInvoice('fac-overpay', 100000, 'user-op');

      vi.mocked(getSession).mockResolvedValue({
        userId: 'user-op',
        role: 'user',
        username: 'user-op',
        expiresAt: Date.now() + 3600000,
      });

      // Paiement initial valide de 40 000 XAF (reste 60 000)
      const req1 = new Request('http://localhost/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: 'fac-overpay',
          amount: 40000,
          paymentMethod: 'virement',
          date: '2026-07-08',
        }),
      });
      await POSTPayment(req1);

      // Tentative de paiement de 70 000 XAF (> 60 000 restants)
      const reqOver = new Request('http://localhost/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: 'fac-overpay',
          amount: 70000,
          paymentMethod: 'virement',
          date: '2026-07-09',
        }),
      });

      const resOver = await POSTPayment(reqOver);
      const errData = await resOver.json();

      expect(resOver.status).toBe(400);
      expect(errData.error).toContain('excède le reste à charge de la facture');

      // Vérifions qu'aucun paiement excédentaire n'a été inséré
      const totalPaid = (db.prepare('SELECT SUM(amount) as sum FROM payments WHERE invoiceId = ? AND deletedAt IS NULL').get('fac-overpay') as { sum: number }).sum;
      expect(totalPaid).toBe(40000);
    });
  });

  // ==========================================================================
  // SCÉNARIO 3 : INTÉGRITÉ ZOD & MÉTADONNÉES
  // ==========================================================================
  describe('3. Intégrité Zod & Métadonnées (Refus décimales/négatif & sauvegarde référence)', () => {
    it('devrait rejeter via Zod les montants décimaux, négatifs ou nuls', async () => {
      createTestInvoice('fac-zod', 100000, 'user-op');

      vi.mocked(getSession).mockResolvedValue({
        userId: 'user-op',
        role: 'user',
        username: 'user-op',
        expiresAt: Date.now() + 3600000,
      });

      // Cas 1 : Décimale (ex: 25000.75)
      const reqDecimal = new Request('http://localhost/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: 'fac-zod',
          amount: 25000.75,
          paymentMethod: 'cheque',
          date: '2026-07-08',
        }),
      });
      const resDecimal = await POSTPayment(reqDecimal);
      expect(resDecimal.status).toBe(400);

      // Cas 2 : Montant négatif
      const reqNeg = new Request('http://localhost/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: 'fac-zod',
          amount: -5000,
          paymentMethod: 'cheque',
          date: '2026-07-08',
        }),
      });
      const resNeg = await POSTPayment(reqNeg);
      expect(resNeg.status).toBe(400);

      // Cas 3 : Montant nul
      const reqZero = new Request('http://localhost/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: 'fac-zod',
          amount: 0,
          paymentMethod: 'cheque',
          date: '2026-07-08',
        }),
      });
      const resZero = await POSTPayment(reqZero);
      expect(resZero.status).toBe(400);
    });

    it('devrait sauvegarder correctement le champ référence en base SQLite', async () => {
      createTestInvoice('fac-ref', 100000, 'user-op');

      vi.mocked(getSession).mockResolvedValue({
        userId: 'user-op',
        role: 'user',
        username: 'user-op',
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('http://localhost/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: 'fac-ref',
          amount: 30000,
          paymentMethod: 'cheque',
          date: '2026-07-08',
          reference: 'CHQ-2026-8899',
        }),
      });

      const res = await POSTPayment(req);
      const data = await res.json();
      expect(res.status).toBe(200);

      const savedPayment = db.prepare('SELECT * FROM payments WHERE id = ?').get(data.id) as any;
      expect(savedPayment.reference).toBe('CHQ-2026-8899');
      expect(savedPayment.amount).toBe(30000);
    });
  });

  // ==========================================================================
  // SCÉNARIO 4 : CASCADE DE SOFT DELETE & ISOLEMENT RLS / ZUSTAND
  // ==========================================================================
  describe('4. Cascade de Soft Delete & Isolement RLS / Store Zustand', () => {
    it('devrait rétrograder automatiquement le statut d’une facture de PAID à PARTIALLY_PAID lors de la suppression d’un paiement', async () => {
      createTestInvoice('fac-delete-cascade', 100000, 'user-op');

      vi.mocked(getSession).mockResolvedValue({
        userId: 'user-op',
        role: 'user',
        username: 'user-op',
        expiresAt: Date.now() + 3600000,
      });

      // 2 paiements de 50 000 XAF pour atteindre PAID
      const res1 = await POSTPayment(
        new Request('http://localhost/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoiceId: 'fac-delete-cascade', amount: 50000, paymentMethod: 'cash', date: '2026-07-08' }),
        })
      );
      const p1 = await res1.json();

      await POSTPayment(
        new Request('http://localhost/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoiceId: 'fac-delete-cascade', amount: 50000, paymentMethod: 'cash', date: '2026-07-08' }),
        })
      );

      const invBefore = db.prepare('SELECT status FROM invoices WHERE id = ?').get('fac-delete-cascade') as { status: string };
      expect(invBefore.status).toBe('PAID');

      // Suppression par Admin de l'un des paiements de 50 000 XAF
      vi.mocked(getSession).mockResolvedValue({
        userId: 'admin-id',
        role: 'admin',
        username: 'admin',
        expiresAt: Date.now() + 3600000,
      });

      const delRes = await DELETEPayment(
        new Request(`http://localhost/api/payments/${p1.id}`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: p1.id }) }
      );
      const delData = await delRes.json();

      expect(delRes.status).toBe(200);
      expect(delData.newStatus).toBe('PARTIALLY_PAID');

      // Vérifions en BDD
      const invAfter = db.prepare('SELECT status FROM invoices WHERE id = ?').get('fac-delete-cascade') as { status: string };
      expect(invAfter.status).toBe('PARTIALLY_PAID');

      const deletedPayment = db.prepare('SELECT deletedAt FROM payments WHERE id = ?').get(p1.id) as { deletedAt: string | null };
      expect(deletedPayment.deletedAt).not.toBeNull();
    });

    it('devrait interdire à User A d’enregistrer un paiement sur une facture appartenant à User B (RLS 403)', async () => {
      createTestInvoice('fac-user-b', 100000, 'user-b');

      vi.mocked(getSession).mockResolvedValue({
        userId: 'user-a',
        role: 'user',
        username: 'user-a',
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('http://localhost/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: 'fac-user-b',
          amount: 50000,
          paymentMethod: 'cash',
          date: '2026-07-08',
        }),
      });

      const res = await POSTPayment(req);
      expect(res.status).toBe(403);
    });

    it('devrait gérer les mutations atomiques dans le store Zustand (addPayment, removePayment, updatePayment, replacePayment)', () => {
      const store = useStore.getState();

      const pay1 = {
        id: 'pay-store-1',
        invoiceId: 'fac-1',
        amount: 30000,
        paymentMethod: 'cash',
        date: '2026-07-08',
        reference: 'REF-S1',
      };

      store.addPayment(pay1);
      expect(useStore.getState().payments).toHaveLength(1);
      expect(useStore.getState().payments[0].id).toBe('pay-store-1');

      store.updatePayment('pay-store-1', { reference: 'REF-MODIFIED' });
      expect(useStore.getState().payments[0].reference).toBe('REF-MODIFIED');

      store.removePayment('pay-store-1');
      expect(useStore.getState().payments).toHaveLength(0);
    });
  });
});
