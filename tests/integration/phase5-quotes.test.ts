import { ROLES, QUOTE_STATUS, INVOICE_STATUS, CLIENT_STATUS } from '@/lib/constants';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getNextNumber } from '@/lib/api/numbering';
import { validateQuoteStatusTransition, computeQuoteStatus } from '@/lib/api/quote-logic';
import { useStore } from '@/lib/store';
import { GET as GETQuotes, POST as POSTQuote } from '@/app/api/quotes/route';
import { GET as GETQuoteById, PUT as PUTQuote, PATCH as PATCHQuote } from '@/app/api/quotes/[id]/route';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
  verifySignature: vi.fn(),
  signSessionCookie: vi.fn(),
}));

describe('🚨 PHASE 5/10 : AUDIT TDD — GESTION DES DEVIS (NUMÉROTATION, ÉTAT, EXPIRATION, RLS) 🚨', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset sequences table for clean deterministic tests
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
      VALUES (1, 'Facturier', 'SARL', 'NIF123', 'RCCM123', 'Libreville', 'contact@facturier.ga', '01020304', 'BGFI', 'AG1', 'ACC123', 'SWIFT1', 'IBAN1', 18, 9.5, 1, 3600, 'FAC', 'DEV', 'GAB')
    `).run();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // SCÉNARIO 1 : GÉNÉRATION DE LA NUMÉROTATION CHRONOLOGIQUE
  // ==========================================================================
  describe('1. Génération de la Numérotation Chronologique & Absence de Collision', () => {
    it('devrait générer des numéros séquentiels incrémentés au format DEV-001/GAB/YYYY sans collision', () => {
      const year = new Date().getFullYear();

      const num1 = getNextNumber('quote');
      const num2 = getNextNumber('quote');
      const num3 = getNextNumber('quote');

      expect(num1).toBe(`DEV-001/GAB/${year}`);
      expect(num2).toBe(`DEV-002/GAB/${year}`);
      expect(num3).toBe(`DEV-003/GAB/${year}`);
      expect(new Set([num1, num2, num3]).size).toBe(3);
    });

    it('devrait attribuer un numéro séquentiel unique lors de la création de devis via API', async () => {
      const year = new Date().getFullYear();

      // Seed client & user
      db.prepare(`
        INSERT INTO clients (id, name, email, created_by)
        VALUES ('client-1', 'Société A', 'a@societe.ga', 'user-op')
      `).run();
      db.prepare(`
        INSERT INTO users (id, username, password, name, email, role, is_active, created_at)
        VALUES ('user-op', 'op', 'pass', 'Opérateur', 'op@test.ga', 'user', 1, datetime('now'))
      `).run();

      vi.mocked(getSession).mockResolvedValue({
        userId: 'user-op',
        role: ROLES.USER,
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
          { description: 'Consultation', quantity: 2, unitPrice: 50000 },
        ],
      };

      const req1 = new Request('http://localhost/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const res1 = await POSTQuote(req1);
      const data1 = await res1.json();

      const req2 = new Request('http://localhost/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const res2 = await POSTQuote(req2);
      const data2 = await res2.json();

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(data1.number).toBe(`DEV-001/GAB/${year}`);
      expect(data2.number).toBe(`DEV-002/GAB/${year}`);
    });
  });

  // ==========================================================================
  // SCÉNARIO 2 : CYCLE DE VIE & MACHINE D'ÉTAT
  // ==========================================================================
  describe("2. Cycle de Vie & Machine d'État (Transitions Autorisées vs Bloquées)", () => {
    it('devrait initialiser un nouveau devis dans le statut EN_ATTENTE', async () => {
      db.prepare(`INSERT INTO clients (id, name, email, created_by) VALUES ('client-1', 'Client', 'c@test.ga', 'user-op')`).run();
      db.prepare(`INSERT INTO users (id, username, password, name, email, role, is_active, created_at) VALUES ('user-op', 'op', 'pass', 'Op', 'op@test.ga', 'user', 1, datetime('now'))`).run();

      vi.mocked(getSession).mockResolvedValue({
        userId: 'user-op',
        role: ROLES.USER,
        username: 'op',
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('http://localhost/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'client-1',
          clientName: 'Client',
          clientEmail: 'c@test.ga',
          date: '2026-07-08',
          discount: 0,
          items: [{ description: 'Prestation', quantity: 1, unitPrice: 100000 }],
        }),
      });

      const res = await POSTQuote(req);
      const { id } = await res.json();

      const quoteInDb = db.prepare('SELECT status FROM quotes WHERE id = ?').get(id) as { status: string };
      expect(quoteInDb.status).toBe(QUOTE_STATUS.EN_ATTENTE);
    });

    it('devrait valider les transitions autorisées par la logique métier', () => {
      expect(validateQuoteStatusTransition('EN_ATTENTE', 'ENVOYE')).toBe(true);
      expect(validateQuoteStatusTransition('EN_ATTENTE', 'REFUSE')).toBe(true);
      expect(validateQuoteStatusTransition('EN_ATTENTE', 'CONVERTI')).toBe(true);
      expect(validateQuoteStatusTransition('ENVOYE', 'REFUSE')).toBe(true);
      expect(validateQuoteStatusTransition('ENVOYE', 'CONVERTI')).toBe(true);
    });

    it('devrait bloquer les transitions impossibles (ex: REFUSE -> CONVERTI, CONVERTI -> REFUSE)', () => {
      expect(validateQuoteStatusTransition('REFUSE', 'CONVERTI')).toBe(false);
      expect(validateQuoteStatusTransition('REFUSE', 'ENVOYE')).toBe(false);
      expect(validateQuoteStatusTransition('CONVERTI', 'EN_ATTENTE')).toBe(false);
      expect(validateQuoteStatusTransition('EXPIRE', 'CONVERTI')).toBe(false);
    });

    it("devrait autoriser ou rejeter la modification d'état via PATCH /api/quotes/[id]", async () => {
      db.prepare(`INSERT INTO users (id, username, password, name, email, role, is_active, created_at) VALUES ('user-op', 'op', 'pass', 'Op', 'op@test.ga', 'user', 1, datetime('now'))`).run();
      db.prepare(`INSERT INTO clients (id, name, email, created_by) VALUES ('c1', 'Client 1', 'c1@t.ga', 'user-op')`).run();
      db.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by)
        VALUES ('quote-refuse', 'DEV-001/GAB/2026', 'c1', 'Client', 'c@t.ga', '2026-07-01', 100000, 0, 100000, 18000, 0, 1000, 119000, 'REFUSE', 'user-op')
      `).run();

      vi.mocked(getSession).mockResolvedValue({
        userId: 'user-op',
        role: ROLES.USER,
        username: 'op',
        expiresAt: Date.now() + 3600000,
      });

      // Tentative de passer de REFUSE -> CONVERTI via PATCH
      const patchReq = new Request('http://localhost/api/quotes/quote-refuse', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: QUOTE_STATUS.CONVERTI }),
      });
      const patchRes = await PATCHQuote(patchReq, { params: Promise.resolve({ id: 'quote-refuse' }) });
      const patchData = await patchRes.json();

      expect(patchRes.status).toBe(400);
      expect(patchData.error).toContain('Transition de statut impossible : de REFUSE à CONVERTI');
    });
  });

  // ==========================================================================
  // SCÉNARIO 3 : DÉPENDANCE TEMPORELLE (EXPIRATION)
  // ==========================================================================
  describe('3. Dépendance Temporelle & Expiration Déterministe', () => {
    it("devrait évaluer un devis à l'état EXPIRE si sa date de validité est dépassée", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));

      const expiredQuote = {
        date: '2026-07-01', // émis il y a 45 jours (validité de base 30 jours -> expire le 31 juillet)
        status: QUOTE_STATUS.EN_ATTENTE,
        validityDays: 30,
      };

      const computedStatus = computeQuoteStatus(expiredQuote, new Date());
      expect(computedStatus).toBe('EXPIRE');
    });

    it('devrait maintenir un devis dans son état actif si sa validité court toujours', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));

      const activeQuote = {
        date: '2026-07-01',
        status: QUOTE_STATUS.EN_ATTENTE,
        validityDays: 30,
      };

      expect(computeQuoteStatus(activeQuote, new Date())).toBe(QUOTE_STATUS.EN_ATTENTE);
    });

    it('ne devrait jamais basculer un devis CONVERTI ou REFUSE en EXPIRE même après des mois', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2030-01-01T12:00:00Z'));

      expect(computeQuoteStatus({ date: '2026-01-01', status: QUOTE_STATUS.CONVERTI }, new Date())).toBe(QUOTE_STATUS.CONVERTI);
      expect(computeQuoteStatus({ date: '2026-01-01', status: QUOTE_STATUS.REFUSE }, new Date())).toBe('REFUSE');
    });
  });

  // ==========================================================================
  // SCÉNARIO 4 : ISOLEMENT RLS & ÉTANCHÉITÉ ZUSTAND
  // ==========================================================================
  describe('4. Isolement RLS (API) & Étanchéité du Store Zustand', () => {
    it('devrait interdire à User A d’accéder ou de modifier un devis appartenant à User B (RLS)', async () => {
      db.prepare(`INSERT INTO users (id, username, password, name, email, role, is_active, created_at) VALUES ('user-a', 'usera', 'pass', 'User A', 'a@test.ga', 'user', 1, datetime('now'))`).run();
      db.prepare(`INSERT INTO users (id, username, password, name, email, role, is_active, created_at) VALUES ('user-b', 'userb', 'pass', 'User B', 'b@test.ga', 'user', 1, datetime('now'))`).run();
      db.prepare(`INSERT INTO clients (id, name, email, created_by) VALUES ('c1', 'Société B', 'b@soc.ga', 'user-b')`).run();

      // Devis appartenant à User B
      db.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by)
        VALUES ('quote-b', 'DEV-001/GAB/2026', 'c1', 'Société B', 'b@soc.ga', '2026-07-08', 100000, 0, 100000, 18000, 0, 1000, 119000, 'EN_ATTENTE', 'user-b')
      `).run();

      // Session en tant que User A
      vi.mocked(getSession).mockResolvedValue({
        userId: 'user-a',
        role: ROLES.USER,
        username: 'usera',
        expiresAt: Date.now() + 3600000,
      });

      // 1. GET /api/quotes/[id] par User A
      const getRes = await GETQuoteById(new Request('http://localhost/api/quotes/quote-b'), {
        params: Promise.resolve({ id: 'quote-b' }),
      });
      expect(getRes.status).toBe(403);

      // 2. PATCH /api/quotes/[id] par User A
      const patchRes = await PATCHQuote(
        new Request('http://localhost/api/quotes/quote-b', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ENVOYE' }),
        }),
        { params: Promise.resolve({ id: 'quote-b' }) }
      );
      expect(patchRes.status).toBe(403);

      // 3. GET /api/quotes ne doit lister que les devis de User A (0 devis trouvés ici)
      const listRes = await GETQuotes(new Request('http://localhost/api/quotes'));
      const listData = await listRes.json();
      expect(Array.isArray(listData)).toBe(true);
      expect(listData.length).toBe(0);
    });

    it('devrait opérer des actions atomiques et immutables dans le store Zustand (addQuote, updateQuote, removeQuote)', () => {
      const store = useStore.getState();

      const q1 = {
        id: 'q-100',
        number: 'DEV-100/GAB/2026',
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
        status: QUOTE_STATUS.EN_ATTENTE,
        items: [],
        createdAt: '2026-07-08',
      };

      // Action addQuote
      store.addQuote(q1);
      expect(useStore.getState().quotes).toHaveLength(1);
      expect(useStore.getState().quotes[0].id).toBe('q-100');

      // Action updateQuote
      store.updateQuote('q-100', { status: QUOTE_STATUS.CONVERTI });
      expect(useStore.getState().quotes[0].status).toBe(QUOTE_STATUS.CONVERTI);

      // Action removeQuote
      store.removeQuote('q-100');
      expect(useStore.getState().quotes).toHaveLength(0);
    });
  });
});
