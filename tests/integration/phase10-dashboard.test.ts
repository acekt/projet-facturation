import { ROLES, QUOTE_STATUS, INVOICE_STATUS, CLIENT_STATUS } from '@/lib/constants';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET as GETDashboardMetrics } from '@/app/api/dashboard/metrics/route';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
  verifySignature: vi.fn(),
  signSessionCookie: vi.fn(),
}));

describe('🚨 PHASE 10/10 : AUDIT TDD — TABLEAU DE BORD OPÉRATIONNEL (AGRÉGATION XAF, FILTRE TEMPOREL, RÉSILIENCE, RLS) 🚨', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    db.prepare('DELETE FROM credit_note_items').run();
    db.prepare('DELETE FROM credit_notes').run();
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM quote_items').run();
    db.prepare('DELETE FROM quotes').run();
    db.prepare('DELETE FROM clients').run();
    db.prepare(`DELETE FROM users WHERE id IN ('admin-dash', 'oper-dash')`).run();

    // Insertion d'un admin, d'un opérateur et d'un client
    db.prepare(`
      INSERT INTO users (id, name, email, username, password, role, is_active, created_at)
      VALUES 
        ('admin-dash', 'Admin Dash', 'admin.dash@lfacturier.ga', 'admindash', 'hash', 'admin', 1, datetime('now')),
        ('oper-dash', 'Oper Dash', 'oper.dash@lfacturier.ga', 'operdash', 'hash', 'user', 1, datetime('now'))
    `).run();

    db.prepare(`
      INSERT INTO clients (id, name, email, created_by)
      VALUES ('client-1', 'Client Test', 'client.test@lfacturier.ga', 'admin-dash')
    `).run();
  });

  afterEach(() => {
    db.prepare('DELETE FROM credit_note_items').run();
    db.prepare('DELETE FROM credit_notes').run();
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM clients WHERE id = ?').run('client-1');
    db.prepare(`DELETE FROM users WHERE id IN ('admin-dash', 'oper-dash')`).run();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // SCÉNARIO 1 : AGRÉGATION FINANCIÈRE (XAF)
  // ==========================================================================
  describe('1. Agrégation Financière en Entiers XAF (totalRevenue & totalPending)', () => {
    it('devrait sommer les montants réellement encaissés (PAID + PARTIALLY_PAID) dans totalRevenue et les restes à charge dans totalPending', async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: 'admin-dash',
        role: ROLES.ADMIN,
        username: 'admindash',
        expiresAt: Date.now() + 3600000,
      });

      const nowStr = new Date().toISOString().split('T')[0];

      // Facture 1 : PAID de 100 000 XAF avec paiement de 100 000 XAF
      db.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, date, total, status, created_by)
        VALUES ('inv-1', 'FAC-001', 'client-1', 'Client A', ?, 100000, 'PAID', 'admin-dash')
      `).run(nowStr);
      db.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date)
        VALUES ('pay-1', 'inv-1', 100000, 'Virement Bancaire', ?)
      `).run(nowStr);

      // Facture 2 : PARTIALLY_PAID de 200 000 XAF avec paiement partiel de 80 000 XAF (reste à charge = 120 000 XAF)
      db.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, date, total, status, created_by)
        VALUES ('inv-2', 'FAC-002', 'client-1', 'Client B', ?, 200000, 'PARTIALLY_PAID', 'admin-dash')
      `).run(nowStr);
      db.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date)
        VALUES ('pay-2', 'inv-2', 80000, 'Airtel Money', ?)
      `).run(nowStr);

      // Facture 3 : UNPAID de 150 000 XAF sans paiement (reste à charge = 150 000 XAF)
      db.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, date, total, status, created_by)
        VALUES ('inv-3', 'FAC-003', 'client-1', 'Client C', ?, 150000, 'UNPAID', 'admin-dash')
      `).run(nowStr);

      const req = new Request('http://localhost/api/dashboard/metrics?range=month');
      const res = await GETDashboardMetrics(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      // Total encaissé = 100 000 + 80 000 = 180 000 XAF
      expect(data.totalRevenue).toBe(180000);
      // Total reste à charge = 120 000 (inv-2) + 150 000 (inv-3) = 270 000 XAF
      expect(data.pendingRevenue).toBe(270000);
      expect(data.paidCount).toBe(1);
      expect(data.partiallyPaidCount).toBe(1);
      expect(data.unpaidCount).toBe(1);
    });
  });

  // ==========================================================================
  // SCÉNARIO 2 : FILTRAGE TEMPOREL (PÉRIODE COURANTE)
  // ==========================================================================
  describe('2. Filtrage Temporel (Exclusion des mois précédents pour le mois en cours)', () => {
    it('devrait exclure du totalRevenue du mois courant les encaissements datant du mois précédent', async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: 'admin-dash',
        role: ROLES.ADMIN,
        username: 'admindash',
        expiresAt: Date.now() + 3600000,
      });

      const now = new Date();
      const currentMonthStr = now.toISOString().split('T')[0];

      // Date du mois précédent
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
      const prevMonthStr = prevMonthDate.toISOString().split('T')[0];

      // Facture & Paiement du mois précédent : 500 000 XAF
      db.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, date, total, status, created_by)
        VALUES ('inv-prev', 'FAC-PREV', 'client-1', 'Client Ancien', ?, 500000, 'PAID', 'admin-dash')
      `).run(prevMonthStr);
      db.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date)
        VALUES ('pay-prev', 'inv-prev', 500000, 'Virement Bancaire', ?)
      `).run(prevMonthStr);

      // Facture & Paiement du mois courant : 70 000 XAF
      db.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, date, total, status, created_by)
        VALUES ('inv-curr', 'FAC-CURR', 'client-1', 'Client Récent', ?, 70000, 'PAID', 'admin-dash')
      `).run(currentMonthStr);
      db.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date)
        VALUES ('pay-curr', 'inv-curr', 70000, 'Espèces', ?)
      `).run(currentMonthStr);

      const req = new Request('http://localhost/api/dashboard/metrics?range=month');
      const res = await GETDashboardMetrics(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      // Ne doit sommer QUE les 70 000 XAF du mois courant !
      expect(data.totalRevenue).toBe(70000);
    });
  });

  // ==========================================================================
  // SCÉNARIO 3 : RÉSILIENCE & DONNÉES VIDES
  // ==========================================================================
  describe('3. Résilience face à une base de données vide (Pas de NaN ou de crash)', () => {
    it('devrait retourner une structure JSON propre avec des montants à 0 sur une BDD vide', async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: 'admin-dash',
        role: ROLES.ADMIN,
        username: 'admindash',
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('http://localhost/api/dashboard/metrics?range=month');
      const res = await GETDashboardMetrics(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.totalRevenue).toBe(0);
      expect(data.pendingRevenue).toBe(0);
      expect(data.overdueRevenue).toBe(0);
      expect(data.growth).toBe('0.0');
      expect(Number.isNaN(Number(data.growth))).toBe(false);
      expect(Array.isArray(data.revenueData)).toBe(true);
      expect(Array.isArray(data.paymentMethodData)).toBe(true);
      expect(Array.isArray(data.activityTimeline)).toBe(true);
    });
  });

  // ==========================================================================
  // SCÉNARIO 4 : ISOLATION RLS SUR LE TABLEAU DE BORD
  // ==========================================================================
  describe('4. Isolation RLS (Opérateur vs Administrateur)', () => {
    it('devrait filtrer les métriques du Dashboard pour l’opérateur sur ses propres factures uniquement', async () => {
      const nowStr = new Date().toISOString().split('T')[0];

      // Facture créée par Admin : 300 000 XAF encaissés
      db.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, date, total, status, created_by)
        VALUES ('inv-admin', 'FAC-ADM', 'client-1', 'Client Admin', ?, 300000, 'PAID', 'admin-dash')
      `).run(nowStr);
      db.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date)
        VALUES ('pay-admin', 'inv-admin', 300000, 'Virement Bancaire', ?)
      `).run(nowStr);

      // Facture créée par Opérateur : 90 000 XAF encaissés
      db.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, date, total, status, created_by)
        VALUES ('inv-oper', 'FAC-OP', 'client-1', 'Client Oper', ?, 90000, 'PAID', 'oper-dash')
      `).run(nowStr);
      db.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date)
        VALUES ('pay-oper', 'inv-oper', 90000, 'Airtel Money', ?)
      `).run(nowStr);

      // 1) Vérification pour l'opérateur connecté
      vi.mocked(getSession).mockResolvedValue({
        userId: 'oper-dash',
        role: ROLES.USER, // Opérateur
        username: 'operdash',
        expiresAt: Date.now() + 3600000,
      });

      const operRes = await GETDashboardMetrics(new Request('http://localhost/api/dashboard/metrics?range=month'));
      const operData = await operRes.json();
      expect(operRes.status).toBe(200);
      // L'opérateur ne voit que ses 90 000 XAF
      expect(operData.totalRevenue).toBe(90000);
      expect(operData.paidCount).toBe(1);
      expect(operData.topClients).toHaveLength(1);
      expect(operData.topClients[0].clientName).toBe('Client Oper');
      expect(operData.topClients[0].totalRevenue).toBe(90000);
      expect(operData.paymentMethodData).toEqual([{ method: 'Airtel Money', amount: 100 }]);
      expect(operData.userPerformance).toEqual([]);

      // 2) Vérification pour l'administrateur connecté
      vi.mocked(getSession).mockResolvedValue({
        userId: 'admin-dash',
        role: ROLES.ADMIN,
        username: 'admindash',
        expiresAt: Date.now() + 3600000,
      });

      const adminRes = await GETDashboardMetrics(new Request('http://localhost/api/dashboard/metrics?range=month'));
      const adminData = await adminRes.json();
      expect(adminRes.status).toBe(200);
      // L'admin voit le total cumulé 300 000 + 90 000 = 390 000 XAF
      expect(adminData.totalRevenue).toBe(390000);
      expect(adminData.paidCount).toBe(2);
      expect(adminData.topClients).toHaveLength(2);
    });
  });
});
