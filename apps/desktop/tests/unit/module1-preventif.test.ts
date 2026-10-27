import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import db from '@/lib/db';
import { createClient, updateClient, deleteClient, getClients, getClientById } from '@/app/actions/client.actions';
import { createService, updateService, deleteService, getServices, getServiceById } from '@/app/actions/service.actions';
import * as authApi from '@/lib/api/auth';
import crypto from 'crypto';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

describe('Module 1 Préventif — Indexation SQLite, Étanchéité Multi-Tenant, RBAC & Audit Trail', () => {
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
  // 1. INDEXATION SQLITE & PLANS D'EXÉCUTION (Scalabilité & Performance)
  // ==========================================================================
  describe('1. Performance & Indexation Composite SQLite', () => {
    it('confirme la présence des index composites créés dans db.ts', () => {
      const indices = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{ name: string }>;
      const indexNames = indices.map(i => i.name);

      expect(indexNames).toContain('idx_clients_tenant_email');
      expect(indexNames).toContain('idx_clients_tenant_name');
      expect(indexNames).toContain('idx_services_tenant_name');
      expect(indexNames).toContain('idx_invoices_client_status');
    });

    it('exploite l index idx_clients_tenant_email lors de la recherche de doublons email', () => {
      const plan = db.prepare(`
        EXPLAIN QUERY PLAN
        SELECT id FROM clients 
        WHERE tenant_id = 'tenant-1' AND lower(email) = lower('test@client.ga') AND deletedAt IS NULL AND email IS NOT NULL
      `).all() as Array<{ detail: string }>;

      const planDetail = plan.map(p => p.detail).join(' ');
      expect(planDetail).toContain('idx_clients_tenant_email');
    });

    it('exploite l index idx_services_tenant_name lors de la recherche de doublons de service', () => {
      const plan = db.prepare(`
        EXPLAIN QUERY PLAN
        SELECT id FROM services 
        WHERE tenant_id = 'tenant-1' AND lower(name) = lower('audit securite') AND deletedAt IS NULL
      `).all() as Array<{ detail: string }>;

      const planDetail = plan.map(p => p.detail).join(' ');
      expect(planDetail).toContain('idx_services_tenant_name');
    });

    it('exploite l index idx_invoices_client_status lors du contrôle des impayés pré-suppression', () => {
      const plan = db.prepare(`
        EXPLAIN QUERY PLAN
        SELECT COUNT(*) as count, SUM(total) as debt 
        FROM invoices 
        WHERE tenant_id = 'tenant-1' AND clientId = 'client-1' AND status IN ('UNPAID', 'PARTIALLY_PAID') AND deletedAt IS NULL
      `).all() as Array<{ detail: string }>;

      const planDetail = plan.map(p => p.detail).join(' ');
      expect(planDetail).toContain('idx_invoices_client_status');
    });
  });

  // ==========================================================================
  // 2. ISOLATION STRICTE MULTI-TENANT (Étanchéité Totale)
  // ==========================================================================
  describe('2. Isolation Multi-Tenant Stricte (Clients & Services)', () => {
    it('garantit une étanchéité de lecture absolue entre deux tenants distincts', async () => {
      // 1. Session Tenant A
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-a',
        name: 'Admin Tenant A',
        role: 'admin',
        tenantId: 'tenant-libreville',
      });

      const clientA = await createClient({
        name: 'Client Entreprise A',
        email: 'contact@alpha.ga',
      });
      expect(clientA.success).toBe(true);

      const serviceA = await createService({
        name: 'Service Consulting A',
        unitPrice: 100000,
      });
      expect(serviceA.success).toBe(true);

      // 2. Session Tenant B
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-b',
        name: 'Admin Tenant B',
        role: 'admin',
        tenantId: 'tenant-portgentil',
      });

      const clientsB = await getClients();
      expect(clientsB.success).toBe(true);
      expect(clientsB.data.length).toBe(0);

      const servicesB = await getServices();
      expect(servicesB.success).toBe(true);
      expect(servicesB.data.length).toBe(0);

      // Tentative d accès direct par ID sur les données du Tenant A
      const getClientB = await getClientById(clientA.data.id);
      expect(getClientB.success).toBe(false);
      expect(getClientB.error).toBe('Client not found');

      const getServiceB = await getServiceById(serviceA.data.id);
      expect(getServiceB.success).toBe(false);
      expect(getServiceB.error).toBe('Service not found');
    });

    it('interdit la modification ou la suppression croisée entre tenants', async () => {
      // Création par Tenant A
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-a',
        name: 'Admin Tenant A',
        role: 'admin',
        tenantId: 'tenant-libreville',
      });
      const clientA = await createClient({ name: 'Client A', email: 'a@a.ga' });
      const serviceA = await createService({ name: 'Service A', unitPrice: 50000 });

      // Tentative de modification par Tenant B
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-b',
        name: 'Admin Tenant B',
        role: 'admin',
        tenantId: 'tenant-portgentil',
      });

      const updateClientRes = await updateClient(clientA.data.id, { name: 'Client Piraté' });
      expect(updateClientRes.success).toBe(false);
      expect(updateClientRes.error).toBe('Client not found');

      const deleteClientRes = await deleteClient(clientA.data.id);
      expect(deleteClientRes.success).toBe(false);
      expect(deleteClientRes.error).toBe('Client not found');

      const updateServiceRes = await updateService(serviceA.data.id, { name: 'Service Piraté', unitPrice: 10 });
      expect(updateServiceRes.success).toBe(false);
      expect(updateServiceRes.error).toBe('Service not found');

      const deleteServiceRes = await deleteService(serviceA.data.id);
      expect(deleteServiceRes.success).toBe(false);
      expect(deleteServiceRes.error).toBe('Service not found');
    });

    it('autorise des noms de clients, emails et services identiques dans deux tenants différents (Scoped Uniqueness)', async () => {
      // Création chez Tenant A
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-a',
        name: 'Admin A',
        role: 'admin',
        tenantId: 'tenant-a',
      });
      const cA = await createClient({ name: 'Partenaire Gabon', email: 'direction@partenaire.ga' });
      const sA = await createService({ name: 'Installation Réseau', unitPrice: 200000 });
      expect(cA.success).toBe(true);
      expect(sA.success).toBe(true);

      // Création identique chez Tenant B (ne doit pas être rejetée pour doublon)
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-b',
        name: 'Admin B',
        role: 'admin',
        tenantId: 'tenant-b',
      });
      const cB = await createClient({ name: 'Partenaire Gabon', email: 'direction@partenaire.ga' });
      const sB = await createService({ name: 'Installation Réseau', unitPrice: 250000 });
      expect(cB.success).toBe(true);
      expect(sB.success).toBe(true);
    });
  });

  // ==========================================================================
  // 3. PISTE D AUDIT INTÉGRALE (Audit Trail)
  // ==========================================================================
  describe('3. Piste d Audit Complète (lib/api/audit.ts)', () => {
    it('enregistre fidèlement CREATE, UPDATE et DELETE pour les clients et services', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'user-admin-audit',
        name: 'Superviseur Audit',
        role: 'admin',
        tenantId: 'tenant-audit-test',
      });

      // Actions sur Client
      const c = await createClient({ name: 'Client Tracé', email: 'trace@audit.ga' });
      await updateClient(c.data.id, { name: 'Client Tracé Renommé' });
      await deleteClient(c.data.id);

      // Actions sur Service
      const s = await createService({ name: 'Service Tracé', unitPrice: 15000 });
      await updateService(s.data.id, { name: 'Service Tracé Modifié', unitPrice: 20000 });
      await deleteService(s.data.id);

      const logs = db.prepare(`
        SELECT action, entityType, entityId, userId, tenant_id 
        FROM audit_logs 
        WHERE tenant_id = 'tenant-audit-test' 
        ORDER BY createdAt ASC
      `).all() as Array<{ action: string; entityType: string; entityId: string; userId: string; tenant_id: string }>;

      expect(logs.length).toBe(6);

      // Logs Client
      expect(logs[0]).toMatchObject({ action: 'CREATE', entityType: 'client', entityId: c.data.id, userId: 'user-admin-audit' });
      expect(logs[1]).toMatchObject({ action: 'UPDATE', entityType: 'client', entityId: c.data.id, userId: 'user-admin-audit' });
      expect(logs[2]).toMatchObject({ action: 'DELETE', entityType: 'client', entityId: c.data.id, userId: 'user-admin-audit' });

      // Logs Service
      expect(logs[3]).toMatchObject({ action: 'CREATE', entityType: 'service', entityId: s.data.id, userId: 'user-admin-audit' });
      expect(logs[4]).toMatchObject({ action: 'UPDATE', entityType: 'service', entityId: s.data.id, userId: 'user-admin-audit' });
      expect(logs[5]).toMatchObject({ action: 'DELETE', entityType: 'service', entityId: s.data.id, userId: 'user-admin-audit' });
    });
  });

  // ==========================================================================
  // 4. CONTRÔLE D ACCÈS RBAC ET GARDE-FOU COMPTABLE
  // ==========================================================================
  describe('4. RBAC Opérateur & Garde-Fou Transactionnel Impayés', () => {
    it('permet à l opérateur de gérer les clients mais lui refuse la suppression', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'op-1',
        name: 'Opérateur Vente',
        role: 'user',
        tenantId: 'tenant-caisse',
      });

      // Opérateur peut créer
      const c = await createClient({ name: 'Client Opérateur' });
      expect(c.success).toBe(true);

      // Opérateur peut mettre à jour
      const u = await updateClient(c.data.id, { name: 'Client Opérateur Mis à Jour' });
      expect(u.success).toBe(true);

      // Opérateur NE PEUT PAS supprimer
      const d = await deleteClient(c.data.id);
      expect(d.success).toBe(false);
      expect(d.error).toBe('Forbidden');
    });

    it('bloque la suppression d un client par un admin s il détient des factures impayées', async () => {
      const tenantId = 'tenant-dette';
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-dette',
        name: 'Admin Finance',
        role: 'admin',
        tenantId,
      });

      const client = await createClient({ name: 'Débiteur SARL' });
      const clientId = client.data.id;

      // Création d une facture impayée
      const invoiceId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, total, status, tenant_id)
        VALUES (?, 'FAC-DETTE-001', ?, 'Débiteur SARL', 'debiteur@sarl.ga', '2026-10-27', '2026-11-27', 450000, 'UNPAID', ?)
      `).run(invoiceId, clientId, tenantId);

      // Tentative de suppression bloquée
      const delRes = await deleteClient(clientId);
      expect(delRes.success).toBe(false);
      expect(delRes.error).toContain('Impossible de supprimer ce client');
      expect(delRes.error).toContain('1 facture(s) impayée(s)');
      expect(delRes.error).toContain('450');

      // Après règlement de la facture (PAID)
      db.prepare("UPDATE invoices SET status = 'PAID' WHERE id = ?").run(invoiceId);

      // La suppression est désormais autorisée
      const delOk = await deleteClient(clientId);
      expect(delOk.success).toBe(true);
    });
  });
});
