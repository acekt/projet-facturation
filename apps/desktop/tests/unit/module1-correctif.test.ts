import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import db from '@/lib/db';
import { createClient, updateClient, deleteClient, getClientById } from '@/app/actions/client.actions';
import * as authApi from '@/lib/api/auth';
import crypto from 'crypto';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

describe('Module 1 Correctif — NIF/RCCM Fiscaux, RBAC Opérateur & Garde-Fou Suppression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.exec(`
      DELETE FROM invoice_items;
      DELETE FROM invoices;
      DELETE FROM clients;
      DELETE FROM services;
      DELETE FROM audit_logs;
    `);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. CONFORMITÉ FISCALE DGI GABON (NIF & RCCM)
  // ==========================================================================
  describe('1. Persistance et Mise à jour des Attributs Fiscaux (NIF & RCCM)', () => {
    it('enregistre et restitue fidèlement le NIF et le RCCM d un client', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-1',
        name: 'Admin Gabon',
        role: 'admin',
        tenantId: 'tenant-libreville',
      });

      const res = await createClient({
        name: 'Société Minière du Haut-Ogooué',
        email: 'direction@smho.ga',
        phone: '+241 077 12 34 56',
        address: 'Moanda, Gabon',
        nif: '8877665M',
        rccm: 'RG/MOA/2026/B/789',
      });

      expect(res.success).toBe(true);
      expect(res.data?.nif).toBe('8877665M');
      expect(res.data?.rccm).toBe('RG/MOA/2026/B/789');

      // Vérification directe en base SQLite
      const clientInDb = db.prepare('SELECT nif, rccm FROM clients WHERE id = ?').get(res.data!.id) as any;
      expect(clientInDb.nif).toBe('8877665M');
      expect(clientInDb.rccm).toBe('RG/MOA/2026/B/789');

      // Mise à jour du NIF et RCCM
      const updateRes = await updateClient(res.data!.id, {
        name: 'Société Minière du Haut-Ogooué SA',
        email: 'direction@smho.ga',
        phone: '+241 077 12 34 56',
        address: 'Moanda, Gabon',
        nif: '8877665M-REV2',
        rccm: 'RG/MOA/2026/B/789-MOD',
      });

      expect(updateRes.success).toBe(true);
      expect(updateRes.data?.nif).toBe('8877665M-REV2');
      expect(updateRes.data?.rccm).toBe('RG/MOA/2026/B/789-MOD');
    });
  });

  // ==========================================================================
  // 2. MATRICE RBAC : CRÉATION CLIENT PAR UN OPÉRATEUR GUICHET
  // ==========================================================================
  describe('2. Matrice RBAC Assouplie pour les Opérateurs Commerciaux', () => {
    it('permet à un opérateur (role user) de créer un nouveau client lors d une facturation', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'operator-1',
        name: 'Opérateur Caisse',
        role: 'user',
        tenantId: 'tenant-libreville',
      });

      const res = await createClient({
        name: 'Client Comptoir Walk-In',
        email: 'walkin@client.ga',
        phone: '+241 065 11 22 33',
        address: 'Centre-ville Libreville',
      });

      expect(res.success).toBe(true);
      expect(res.data?.name).toBe('Client Comptoir Walk-In');
    });

    it('interdit strictement la suppression d un client à un opérateur (admin only)', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-1',
        name: 'Admin Gabon',
        role: 'admin',
        tenantId: 'tenant-libreville',
      });

      const client = await createClient({
        name: 'Client À Protéger',
        email: 'protege@client.ga',
      });
      expect(client.success).toBe(true);

      // Session opérateur
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'operator-1',
        name: 'Opérateur Caisse',
        role: 'user',
        tenantId: 'tenant-libreville',
      });

      const deleteRes = await deleteClient(client.data!.id);
      expect(deleteRes.success).toBe(false);
      expect(deleteRes.error).toBe('Forbidden');

      // Le client est toujours actif
      const checkInDb = db.prepare('SELECT deletedAt FROM clients WHERE id = ?').get(client.data!.id) as any;
      expect(checkInDb.deletedAt).toBeNull();
    });
  });

  // ==========================================================================
  // 3. GARDE-FOU SUPPRESSION : CLIENTS AVEC FACTURES IMPAYÉES
  // ==========================================================================
  describe('3. Garde-Fou Comptable contre la Suppression de Clients avec Dettes Actives', () => {
    it('bloque la suppression d un client s il possède des factures impayées actives et indique le montant dû', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-1',
        name: 'Admin Gabon',
        role: 'admin',
        tenantId: 'tenant-libreville',
      });

      const clientRes = await createClient({
        name: 'Client Débiteur SARL',
        email: 'debiteur@dette.ga',
      });
      const clientId = clientRes.data!.id;

      // Création d'une facture impayée rattachée à ce client
      const invoiceId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, total, status, tenant_id)
        VALUES (?, 'FAC-2026-001', ?, 'Client Débiteur SARL', 'debiteur@dette.ga', '2026-10-27', '2026-11-27', 450000, 'UNPAID', 'tenant-libreville')
      `).run(invoiceId, clientId);

      // Tentative de suppression par l'administrateur
      const deleteAttempt = await deleteClient(clientId);
      expect(deleteAttempt.success).toBe(false);
      expect(deleteAttempt.error).toContain('1 facture(s) impayée(s) en cours');
      expect(deleteAttempt.error).toContain('450');

      // Le client ne doit PAS être supprimé
      const clientAfter = db.prepare('SELECT deletedAt FROM clients WHERE id = ?').get(clientId) as any;
      expect(clientAfter.deletedAt).toBeNull();

      // Une fois la facture soldée (PAID), la suppression doit réussir
      db.prepare("UPDATE invoices SET status = 'PAID' WHERE id = ?").run(invoiceId);

      const deleteSuccess = await deleteClient(clientId);
      expect(deleteSuccess.success).toBe(true);

      const clientDeleted = db.prepare('SELECT deletedAt FROM clients WHERE id = ?').get(clientId) as any;
      expect(clientDeleted.deletedAt).not.toBeNull();
    });
  });
});
