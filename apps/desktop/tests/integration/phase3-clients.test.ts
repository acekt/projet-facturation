import { ROLES, QUOTE_STATUS, INVOICE_STATUS, CLIENT_STATUS } from '@/lib/constants';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDatabase, seedTestData, cleanupTestDatabase, createAuthenticatedSession, getTestDatabase } from '../helpers/db';
import crypto from 'crypto';

// Mock the global db module to redirect to test database (must be before API route imports)
vi.mock('@/lib/db', () => ({
  default: getTestDatabase(),
}));

// Mock the getSession function
vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

import { GET as GETClients, POST as POSTClient } from '@/app/api/clients/route';
import { GET as GETClientById, PATCH as PATCHClient, DELETE as DELETEClient } from '@/app/api/clients/[id]/route';
import { getSession } from '@/lib/api/auth';
import { useStore } from '@/lib/store';

describe('🚨 PHASE 3/10 : AUDIT TDD — MODULE GESTION DES CLIENTS 🚨', () => {
  let testDb: ReturnType<typeof createTestDatabase>;

  beforeEach(() => {
    testDb = createTestDatabase();
    seedTestData(testDb);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDatabase();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // SCÉNARIO 1 : INTÉGRITÉ API & FORMATAGE (VALIDATION ZOD SERVEUR)
  // ==========================================================================
  describe('1. Intégrité API & Formatage (Zod clientSchema)', () => {
    it('devrait rejeter la création d\'un client si l\'adresse email est invalide', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);

      const invalidEmailPayload = {
        name: 'Entreprise ABC',
        email: 'email-mal-formate-sans-arobase',
        phone: '+241 01 02 03 04',
        address: 'Libreville, Gabon',
      };

      const request = new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidEmailPayload),
      });

      const response = await POSTClient(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Données invalides');
      expect(data.details.fieldErrors.email).toBeDefined();
    });

    it('devrait rejeter la création si le numéro de téléphone est trop court / invalide', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);

      const invalidPhonePayload = {
        name: 'Société XYZ',
        email: 'contact@societexyz.ga',
        phone: '12', // Trop court (< 6 caractères selon le refine de clientSchema)
      };

      const request = new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPhonePayload),
      });

      const response = await POSTClient(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.details.fieldErrors.phone).toBeDefined();
    });

    it('devrait créer avec succès un client valide et horodater / persister created_by', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);

      const validPayload = {
        name: 'Gabon Technologies',
        email: 'info@gabontech.ga',
        phone: '+241 077 00 11 22',
        address: 'Boulevard de Nice, Libreville',
      };

      const request = new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });

      const response = await POSTClient(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Gabon Technologies');
      expect(data.email).toBe('info@gabontech.ga');

      // Vérification SQLite
      const dbRow = testDb.prepare('SELECT * FROM clients WHERE id = ?').get(data.id) as any;
      expect(dbRow.created_by).toBe(session.userId);
    });
  });

  // ==========================================================================
  // SCÉNARIO 2 : PRÉVENTION DES DOUBLONS (CONFLIT 409)
  // ==========================================================================
  describe('2. Prévention des Doublons (Erreur 409 Conflict)', () => {
    it('devrait interdire la création d\'un second client avec exactement le même email pour le même utilisateur', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);

      const payload = {
        name: 'Client Alpha',
        email: 'alpha@doublon.com',
        phone: '+241 01 11 22 33',
      };

      // Création initiale réussie
      const firstRes = await POSTClient(
        new Request('http://localhost/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      );
      expect(firstRes.status).toBe(200);

      // Tentative de recréer un client avec le même email
      const secondRes = await POSTClient(
        new Request('http://localhost/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Client Alpha Bis',
            email: 'ALPHA@DOUBLON.COM', // Test insensible à la casse
          }),
        })
      );
      const secondData = await secondRes.json();

      expect(secondRes.status).toBe(409);
      expect(secondData.error).toContain('existe déjà');
    });
  });

  // ==========================================================================
  // SCÉNARIO 3 : SÉCURITÉ (RLS ABSOLU ENTRE UTILISATEURS)
  // ==========================================================================
  describe('3. Sécurité (RLS Absolu & Isolation Inter-Utilisateurs)', () => {
    it('devrait permettre à User A de voir tous les clients (référentiel commun) dans la liste GET /api/clients', async () => {
      // ARRANGE : Créer Admin et User A en BDD
      const adminId = 'client-admin-id';
      const userAId = 'client-user-a-id';

      testDb.prepare(`
        INSERT OR REPLACE INTO users (id, username, email, password, name, role, is_active, force_password_change, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(adminId, 'admin_cli', 'admin_cli@test.com', 'hash', 'Admin Cli', 'admin', 1, 0, new Date().toISOString());

      testDb.prepare(`
        INSERT OR REPLACE INTO users (id, username, email, password, name, role, is_active, force_password_change, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userAId, 'usera_cli', 'usera_cli@test.com', 'hash', 'User A Cli', 'user', 1, 0, new Date().toISOString());

      // Admin crée un client
      vi.mocked(getSession).mockResolvedValue({ userId: adminId, role: ROLES.ADMIN, name: 'Admin Cli', username: 'admin_cli' });
      const resCreateB = await POSTClient(
        new Request('http://localhost/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Client Commun',
            email: 'commun@client.com',
          }),
        })
      );
      const clientB = await resCreateB.json();
      expect(resCreateB.status).toBe(200);

      // ACT : User A appelle GET /api/clients
      vi.mocked(getSession).mockResolvedValue({ userId: userAId, role: ROLES.USER, name: 'User A Cli', username: 'usera_cli' });
      const listResA = await GETClients();
      const listA = await listResA.json();

      // ASSERT : La liste de User A DOIT contenir le client (référentiel commun)
      expect(Array.isArray(listA)).toBe(true);
      expect(listA.some((c: any) => c.id === clientB.id)).toBe(true);
    });

    it('devrait interdire à User B de modifier (PATCH) ou supprimer (DELETE) un client', async () => {
      const adminId = 'client-admin-id';
      const userBId = 'client-user-b-id';

      testDb.prepare(`
        INSERT OR REPLACE INTO users (id, username, email, password, name, role, is_active, force_password_change, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(adminId, 'admin_cli', 'admin_cli@test.com', 'hash', 'Admin Cli', 'admin', 1, 0, new Date().toISOString());

      testDb.prepare(`
        INSERT OR REPLACE INTO users (id, username, email, password, name, role, is_active, force_password_change, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userBId, 'userb_cli', 'userb_cli@test.com', 'hash', 'User B Cli', 'user', 1, 0, new Date().toISOString());

      // Admin crée le client
      vi.mocked(getSession).mockResolvedValue({ userId: adminId, role: ROLES.ADMIN, name: 'Admin Cli', username: 'admin_cli' });
      const resCreateA = await POSTClient(
        new Request('http://localhost/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Client A Sécurisé',
            email: 'secure_a@client.com',
          }),
        })
      );
      const clientA = await resCreateA.json();

      // Switch vers User B
      vi.mocked(getSession).mockResolvedValue({ userId: userBId, role: ROLES.USER, name: 'User B Cli', username: 'userb_cli' });

      // Tentative PATCH par User B
      const patchRes = await PATCHClient(
        new Request(`http://localhost/api/clients/${clientA.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Piratage par B', email: 'secure_a@client.com' }),
        }),
        { params: Promise.resolve({ id: clientA.id }) }
      );
      expect(patchRes.status).toBe(403);

      // Tentative DELETE par User B
      const deleteRes = await DELETEClient(
        new Request(`http://localhost/api/clients/${clientA.id}`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: clientA.id }) }
      );
      expect(deleteRes.status).toBe(403);
    });
  });

  // ==========================================================================
  // SCÉNARIO 4 : SOFT DELETE & NON-DESTRUCTION PHYSIQUE EN BASE
  // ==========================================================================
  describe('4. Soft Delete (Non-Destruction Physique en Base SQLite)', () => {
    it('devrait horodater deletedAt sans supprimer physiquement la ligne et exclure le client des requêtes ultérieures', async () => {
      const adminId = 'client-admin-id';
      testDb.prepare(`
        INSERT OR REPLACE INTO users (id, username, email, password, name, role, is_active, force_password_change, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(adminId, 'admin_cli', 'admin_cli@test.com', 'hash', 'Admin Cli', 'admin', 1, 0, new Date().toISOString());

      vi.mocked(getSession).mockResolvedValue({ userId: adminId, role: ROLES.ADMIN, name: 'Admin Cli', username: 'admin_cli' });

      const resCreate = await POSTClient(
        new Request('http://localhost/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Client Soft Deleted',
            email: 'soft@delete.com',
          }),
        })
      );
      const client = await resCreate.json();

      // ACT : Suppression (Soft Delete)
      const delRes = await DELETEClient(
        new Request(`http://localhost/api/clients/${client.id}`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: client.id }) }
      );
      expect(delRes.status).toBe(200);

      // ASSERT 1 : Vérification directe sur SQLite de la persistance physique avec deletedAt non nul
      const rawRow = testDb.prepare('SELECT id, name, deletedAt FROM clients WHERE id = ?').get(client.id) as any;
      expect(rawRow).toBeDefined();
      expect(rawRow.id).toBe(client.id);
      expect(rawRow.deletedAt).not.toBeNull();

      // ASSERT 2 : GET by ID renvoie 404
      const getByIdRes = await GETClientById(
        new Request(`http://localhost/api/clients/${client.id}`),
        { params: Promise.resolve({ id: client.id }) }
      );
      expect(getByIdRes.status).toBe(404);
    });
  });

  // ==========================================================================
  // SCÉNARIO BONUS : STORE ZUSTAND (RÉSILIENCE ET IMMUABILITÉ FONCTIONNELLE)
  // ==========================================================================
  describe('Bonus. Store Zustand (Mises à jour atomiques sans Stale Closure)', () => {
    it('devrait ajouter et mettre à jour un client dans le store de façon immuable', () => {
      useStore.getState().setClients([]);

      const c1 = { id: 'c-1', name: 'Client 1', email: 'c1@test.com' };
      const c2 = { id: 'c-2', name: 'Client 2', email: 'c2@test.com' };

      useStore.getState().addClient(c1);
      useStore.getState().addClient(c2);

      useStore.getState().updateClient('c-1', { name: 'Client 1 Mis à jour' });

      const clients = useStore.getState().clients;
      expect(clients).toHaveLength(2);
      expect(clients.find((c) => c.id === 'c-1')?.name).toBe('Client 1 Mis à jour');
      expect(clients.find((c) => c.id === 'c-2')?.name).toBe('Client 2');
    });
  });
});
