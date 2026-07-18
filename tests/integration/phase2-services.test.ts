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

import { GET as GETServices, POST as POSTService } from '@/app/api/services/route';
import { GET as GETServiceById, PATCH as PATCHService, DELETE as DELETEService } from '@/app/api/services/[id]/route';
import { getSession } from '@/lib/api/auth';
import { useStore } from '@/lib/store';

describe('🚨 PHASE 2/10 : AUDIT TDD — MODULE CATALOGUE DE SERVICES 🚨', () => {
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
  // SCÉNARIO 1 : INTÉGRITÉ API (CRUD & ZOD EN XAF)
  // ==========================================================================
  describe('1. Intégrité API (CRUD & Validation Zod Serveur en XAF)', () => {
    it('devrait rejeter la création d\'un service si unitPrice contient une décimale (XAF sans centimes)', async () => {
      // ARRANGE : Utilisateur connecté et payload invalide (prix décimal)
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);

      const invalidPayload = {
        name: 'Consultation Technique',
        description: 'Heure de conseil spécialisé',
        category: 'Conseil',
        unitPrice: 15000.75, // Interdit en XAF
      };

      const request = new Request('http://localhost/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      // ACT
      const response = await POSTService(request);
      const data = await response.json();

      // ASSERT : Rejet Zod 400
      expect(response.status).toBe(400);
      expect(data.error).toBe('Données invalides');
      expect(data.details.fieldErrors.unitPrice).toBeDefined();
    });

    it('devrait rejeter la création si un champ obligatoire (name) est manquant ou vide', async () => {
      // ARRANGE
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);

      const missingNamePayload = {
        name: '',
        unitPrice: 25000,
      };

      const request = new Request('http://localhost/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(missingNamePayload),
      });

      // ACT
      const response = await POSTService(request);
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(400);
      expect(data.details.fieldErrors.name).toBeDefined();
    });

    it('devrait créer avec succès un service valide et enregistrer le créateur (created_by)', async () => {
      // ARRANGE
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);

      const validPayload = {
        name: 'Audit de Sécurité SI',
        description: 'Évaluation complète du réseau',
        category: 'Sécurité',
        unitPrice: 500000,
      };

      const request = new Request('http://localhost/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });

      // ACT
      const response = await POSTService(request);
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(200);
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Audit de Sécurité SI');
      expect(data.unitPrice).toBe(500000);

      // Vérification en base SQLite que created_by est bien stocké
      const dbRow = testDb.prepare('SELECT * FROM services WHERE id = ?').get(data.id) as any;
      expect(dbRow.created_by).toBe(session.userId);
    });
  });

  // ==========================================================================
  // SCÉNARIO 2 : SÉCURITÉ (RLS & ISOLATION ENTRE UTILISATEURS)
  // ==========================================================================
  describe('2. Sécurité (RLS & Isolation Inter-Utilisateurs)', () => {
    it('devrait interdire à User B de modifier (PATCH) un service créé par User A', async () => {
      // ARRANGE : Créer User A en BDD et son sessionA
      const userAId = 'user-a-id';
      testDb.prepare(`
        INSERT OR REPLACE INTO users (id, username, email, password, name, role, is_active, force_password_change, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userAId, 'usera', 'usera@test.com', 'hash', 'User A (Admin)', 'admin', 1, 0, new Date().toISOString());

      const sessionA = { userId: userAId, role: ROLES.ADMIN, name: 'User A', username: 'usera' };
      vi.mocked(getSession).mockResolvedValue(sessionA);

      const createRes = await POSTService(
        new Request('http://localhost/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Service Privé User A',
            unitPrice: 100000,
          }),
        })
      );
      const serviceA = await createRes.json();

      // Switch de session vers User B (autre utilisateur standard)
      const userBId = 'user-b-id';
      testDb.prepare(`
        INSERT OR REPLACE INTO users (id, username, email, password, name, role, is_active, force_password_change, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userBId, 'userb', 'userb@test.com', 'hash', 'User B', 'user', 1, 0, new Date().toISOString());

      const sessionB = { userId: userBId, role: ROLES.USER, name: 'User B', username: 'userb' };
      vi.mocked(getSession).mockResolvedValue(sessionB);

      // ACT : User B tente de modifier le service de User A
      const patchRequest = new Request(`http://localhost/api/services/${serviceA.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Tentative Piratage par User B',
          unitPrice: 1,
        }),
      });

      const patchResponse = await PATCHService(patchRequest, { params: Promise.resolve({ id: serviceA.id }) });

      // ASSERT : Rejet 403 Forbidden
      expect(patchResponse.status).toBe(403);
    });

    it('devrait interdire à User B de supprimer (DELETE) un service créé par User A', async () => {
      // ARRANGE : User A crée un service
      const userAId = 'user-a-id';
      testDb.prepare(`
        INSERT OR REPLACE INTO users (id, username, email, password, name, role, is_active, force_password_change, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userAId, 'usera', 'usera@test.com', 'hash', 'User A (Admin)', 'admin', 1, 0, new Date().toISOString());

      const sessionA = { userId: userAId, role: ROLES.ADMIN, name: 'User A', username: 'usera' };
      vi.mocked(getSession).mockResolvedValue(sessionA);

      const createRes = await POSTService(
        new Request('http://localhost/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Service Critique User A',
            unitPrice: 200000,
          }),
        })
      );
      const serviceA = await createRes.json();

      // Switch vers User B
      const userBId = 'user-b-id';
      testDb.prepare(`
        INSERT OR REPLACE INTO users (id, username, email, password, name, role, is_active, force_password_change, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userBId, 'userb', 'userb@test.com', 'hash', 'User B', 'user', 1, 0, new Date().toISOString());

      const sessionB = { userId: userBId, role: ROLES.USER, name: 'User B', username: 'userb' };
      vi.mocked(getSession).mockResolvedValue(sessionB);

      // ACT : User B tente de supprimer le service de User A
      const deleteRequest = new Request(`http://localhost/api/services/${serviceA.id}`, {
        method: 'DELETE',
      });

      const deleteResponse = await DELETEService(deleteRequest, { params: Promise.resolve({ id: serviceA.id }) });

      // ASSERT : Rejet 403 Forbidden
      expect(deleteResponse.status).toBe(403);
    });

    it('devrait autoriser User A à modifier son propre service', async () => {
      // ARRANGE : User A crée un service
      const sessionA = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(sessionA);

      const createRes = await POSTService(
        new Request('http://localhost/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Service Modifiable A',
            unitPrice: 150000,
          }),
        })
      );
      const serviceA = await createRes.json();

      // ACT : User A modifie son propre service
      const patchRequest = new Request(`http://localhost/api/services/${serviceA.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Service Modifié par A',
          unitPrice: 175000,
        }),
      });

      const patchResponse = await PATCHService(patchRequest, { params: Promise.resolve({ id: serviceA.id }) });
      const updatedData = await patchResponse.json();

      // ASSERT
      expect(patchResponse.status).toBe(200);
      expect(updatedData.name).toBe('Service Modifié par A');
      expect(updatedData.unitPrice).toBe(175000);
    });
  });

  // ==========================================================================
  // SCÉNARIO 3 : SOFT DELETE (NON-DESTRUCTION EN BASE)
  // ==========================================================================
  describe('3. Soft Delete (Non-Destruction Physique en Base SQLite)', () => {
    it('devrait marquer deletedAt sans effacer la ligne en BDD et exclure le service des requêtes ultérieures', async () => {
      // ARRANGE : User A crée un service
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);

      const createRes = await POSTService(
        new Request('http://localhost/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Service à Supprimer (Soft Delete)',
            unitPrice: 300000,
          }),
        })
      );
      const service = await createRes.json();

      // ACT : Appel de l'endpoint DELETE
      const deleteRequest = new Request(`http://localhost/api/services/${service.id}`, {
        method: 'DELETE',
      });
      const deleteResponse = await DELETEService(deleteRequest, { params: Promise.resolve({ id: service.id }) });

      // ASSERT 1 : Réponse succès API
      expect(deleteResponse.status).toBe(200);

      // ASSERT 2 : Vérification en direct sur SQLite que la ligne existe TOUJOURS (Pas de Hard Delete)
      const rawDbRow = testDb.prepare('SELECT id, name, deletedAt FROM services WHERE id = ?').get(service.id) as any;
      expect(rawDbRow).toBeDefined();
      expect(rawDbRow.id).toBe(service.id);
      expect(rawDbRow.deletedAt).not.toBeNull();

      // ASSERT 3 : Un GET /api/services/[id] ultérieur renvoie 404
      const getByIdRes = await GETServiceById(
        new Request(`http://localhost/api/services/${service.id}`),
        { params: Promise.resolve({ id: service.id }) }
      );
      expect(getByIdRes.status).toBe(404);

      // ASSERT 4 : Un GET /api/services n'inclut plus ce service dans la liste
      const getListRes = await GETServices();
      const listData = await getListRes.json();
      expect(listData.some((s: any) => s.id === service.id)).toBe(false);
    });
  });

  // ==========================================================================
  // SCÉNARIO 4 : ÉTAT ZUSTAND (RÉSILIENCE & UPDATES FONCTIONNELS)
  // ==========================================================================
  describe('4. Store Zustand (Résilience des Actions & Absence de Stale Closure)', () => {
    it('devrait ajouter (addService) puis mettre à jour (updateService) l\'état sans perte de données', () => {
      // ARRANGE : Réinitialisation du store Zustand pour le test
      useStore.getState().setServices([]);

      const mockService1 = {
        id: 'srv-test-1',
        name: 'Service Initial',
        category: 'Ingénierie',
        unitPrice: 100000,
      };

      const mockService2 = {
        id: 'srv-test-2',
        name: 'Service Deuxième',
        category: 'Formation',
        unitPrice: 250000,
      };

      // ACT 1 : Ajout de 2 services au store
      useStore.getState().addService(mockService1);
      useStore.getState().addService(mockService2);

      expect(useStore.getState().services).toHaveLength(2);

      // ACT 2 : Mise à jour du premier service via updateService
      useStore.getState().updateService('srv-test-1', {
        name: 'Service Initial Mis À Jour',
        unitPrice: 120000,
      });

      // ASSERT : L'état a été mis à jour de manière immuable et le second service est intact (Pas d'écrasement)
      const stateServices = useStore.getState().services;
      expect(stateServices).toHaveLength(2);

      const updatedSrv1 = stateServices.find((s) => s.id === 'srv-test-1');
      const intactSrv2 = stateServices.find((s) => s.id === 'srv-test-2');

      expect(updatedSrv1).toBeDefined();
      expect(updatedSrv1?.name).toBe('Service Initial Mis À Jour');
      expect(updatedSrv1?.unitPrice).toBe(120000);
      expect(updatedSrv1?.category).toBe('Ingénierie'); // Conservé via spread {...s, ...data}

      expect(intactSrv2?.name).toBe('Service Deuxième');
      expect(intactSrv2?.unitPrice).toBe(250000);
    });
  });
});
