import { ROLES, QUOTE_STATUS, INVOICE_STATUS, CLIENT_STATUS } from '@/lib/constants';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from '@/lib/store';
import { GET as GETUsers, POST as POSTUser } from '@/app/api/users/route';
import { PATCH as PATCHUser, PUT as PUTUser, DELETE as DELETEUser } from '@/app/api/users/[id]/route';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
  verifySignature: vi.fn(),
  signSessionCookie: vi.fn(),
}));

describe('🚨 PHASE 8/10 : AUDIT TDD — UTILISATEURS & RÔLES (BCRYPT, ANTI-LOCKOUT, RBAC, ZOD) 🚨', () => {
  const testUserIds = ['admin-self', 'target-u', 'u-edit', 'admin-1'];

  beforeEach(() => {
    vi.clearAllMocks();
    db.prepare(`DELETE FROM users WHERE id IN ('admin-self', 'target-u', 'u-edit', 'admin-1', 'admin-user', 'user-user') OR email LIKE '%@lfacturier.ga' OR username IN ('admin', 'user', 'operator')`).run();
  });

  afterEach(() => {
    db.prepare(`DELETE FROM users WHERE id IN ('admin-self', 'target-u', 'u-edit', 'admin-1', 'admin-user', 'user-user') OR email LIKE '%@lfacturier.ga' OR username IN ('admin', 'user', 'operator')`).run();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // SCÉNARIO 1 : SÉCURITÉ DU HACHAGE (BCRYPT)
  // ==========================================================================
  describe('1. Sécurité du Hachage (Bcrypt & Non-exposition en clair)', () => {
    it('devrait hacher le mot de passe via Bcrypt lors du POST /api/users et ne jamais le stocker ni le renvoyer en clair', async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: 'admin-1',
        role: ROLES.ADMIN,
        username: 'admin',
        expiresAt: Date.now() + 3600000,
      });

      const payload = {
        name: 'Opérateur Comptable',
        email: 'op@lfacturier.ga',
        username: 'op_comptable',
        role: ROLES.USER,
        password: 'SecretPassword123!',
        is_active: true,
      };

      const req = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await POSTUser(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.password).toBeUndefined(); // Pas de retour du mot de passe dans le JSON de réponse
      expect(data.id).toBeDefined();

      // Vérification physique en BDD SQLite
      const rawUser = db.prepare('SELECT password FROM users WHERE id = ?').get(data.id) as { password: string };
      expect(rawUser).toBeDefined();
      expect(rawUser.password).not.toBe('SecretPassword123!');
      // Bcrypt hash commence par $2a$ ou $2b$
      expect(rawUser.password).toMatch(/^\$2[ab]\$/);
    });
  });

  // ==========================================================================
  // SCÉNARIO 2 : PROTECTION ANTI-LOCKOUT (ADMIN PRINCIPAL)
  // ==========================================================================
  describe('2. Protection Anti-Lockout (Interdiction d’auto-suppression et d’auto-rétrogradation)', () => {
    it('devrait interdire à l’administrateur de supprimer son propre compte (400 Bad Request)', async () => {
      db.prepare(`
        INSERT INTO users (id, name, email, username, password, role, is_active, created_at)
        VALUES ('admin-self', 'Super Admin', 'admin@lfacturier.ga', 'admin', '$2b$10$hash', 'admin', 1, datetime('now'))
      `).run();

      vi.mocked(getSession).mockResolvedValue({
        userId: 'admin-self',
        role: ROLES.ADMIN,
        username: 'admin',
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('http://localhost/api/users/admin-self', { method: 'DELETE' });
      const res = await DELETEUser(req, { params: Promise.resolve({ id: 'admin-self' }) });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('Impossible de supprimer votre propre compte');

      // Vérification que le compte est toujours actif en BDD
      const rawUser = db.prepare('SELECT is_active, deletedAt FROM users WHERE id = ?').get('admin-self') as { is_active: number; deletedAt: string | null };
      expect(rawUser.is_active).toBe(1);
      expect(rawUser.deletedAt).toBeNull();
    });

    it('devrait interdire à l’administrateur de rétrograder son propre rôle vers user (400 Bad Request)', async () => {
      db.prepare(`
        INSERT INTO users (id, name, email, username, password, role, is_active, created_at)
        VALUES ('admin-self', 'Super Admin', 'admin@lfacturier.ga', 'admin', '$2b$10$hash', 'admin', 1, datetime('now'))
      `).run();

      vi.mocked(getSession).mockResolvedValue({
        userId: 'admin-self',
        role: ROLES.ADMIN,
        username: 'admin',
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('http://localhost/api/users/admin-self', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Super Admin',
          email: 'admin@lfacturier.ga',
          role: ROLES.USER,
        }),
      });

      const res = await PATCHUser(req, { params: Promise.resolve({ id: 'admin-self' }) });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('Impossible de rétrograder votre propre rôle administrateur');

      const rawUser = db.prepare('SELECT role FROM users WHERE id = ?').get('admin-self') as { role: string };
      expect(rawUser.role).toBe('admin');
    });
  });

  // ==========================================================================
  // SCÉNARIO 3 : RBAC STRICT SUR L'ADMINISTRATION
  // ==========================================================================
  describe('3. RBAC Strict sur les routes Utilisateurs (403 Forbidden pour operator / user)', () => {
    it('devrait rejeter systématiquement un utilisateur non-admin sur GET, POST, PATCH et DELETE', async () => {
      db.prepare(`
        INSERT INTO users (id, name, email, username, password, role, is_active, created_at)
        VALUES ('target-u', 'Target', 't@test.ga', 'target', '$2b$10$hash', 'user', 1, datetime('now'))
      `).run();

      vi.mocked(getSession).mockResolvedValue({
        userId: 'operator-1',
        role: ROLES.USER, // non-admin
        username: 'oper',
        expiresAt: Date.now() + 3600000,
      });

      const getRes = await GETUsers();
      expect(getRes.status).toBe(403);

      const postRes = await POSTUser(
        new Request('http://localhost/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'X', email: 'x@t.ga', username: 'xx', role: ROLES.USER, password: 'Password123!' }),
        })
      );
      expect(postRes.status).toBe(403);

      const patchRes = await PATCHUser(
        new Request('http://localhost/api/users/target-u', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Hacked' }),
        }),
        { params: Promise.resolve({ id: 'target-u' }) }
      );
      expect(patchRes.status).toBe(403);

      const delRes = await DELETEUser(
        new Request('http://localhost/api/users/target-u', { method: 'DELETE' }),
        { params: Promise.resolve({ id: 'target-u' }) }
      );
      expect(delRes.status).toBe(403);
    });
  });

  // ==========================================================================
  // SCÉNARIO 4 : INTÉGRITÉ ZOD & ÉDITION SANS MOT DE PASSE (STORE ZUSTAND)
  // ==========================================================================
  describe('4. Intégrité Zod (Mot de passe optionnel vide en édition) & Store Zustand', () => {
    it('devrait accepter un mot de passe vide "" lors d’un PATCH/PUT sans modifier le hash Bcrypt existant', async () => {
      const originalHash = '$2b$10$OriginalBcryptHashDoNotChange123456789';
      db.prepare(`
        INSERT INTO users (id, name, email, username, password, role, is_active, created_at)
        VALUES ('u-edit', 'Alice', 'alice@lfacturier.ga', 'alice', ?, 'user', 1, datetime('now'))
      `).run(originalHash);

      vi.mocked(getSession).mockResolvedValue({
        userId: 'admin-1',
        role: ROLES.ADMIN,
        username: 'admin',
        expiresAt: Date.now() + 3600000,
      });

      const req = new Request('http://localhost/api/users/u-edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Alice Updated',
          email: 'alice@lfacturier.ga',
          role: ROLES.USER,
          password: '', // Chaîne vide envoyée par le formulaire en cas de non-changement
        }),
      });

      const res = await PATCHUser(req, { params: Promise.resolve({ id: 'u-edit' }) });
      expect(res.status).toBe(200);

      // Vérification que le hash d'origine est préservé et non écrasé
      const rawUser = db.prepare('SELECT name, password FROM users WHERE id = ?').get('u-edit') as { name: string; password: string };
      expect(rawUser.name).toBe('Alice Updated');
      expect(rawUser.password).toBe(originalHash);
    });

    it('devrait gérer correctement les mutations atomiques d’utilisateurs dans le store Zustand', () => {
      const store = useStore.getState();

      const user1 = {
        id: 'u-store-1',
        name: 'John Doe',
        email: 'john@lfacturier.ga',
        username: 'johndoe',
        role: ROLES.USER,
        is_active: 1,
        created_at: '2026-07-08',
      };

      store.addUser(user1);
      expect(useStore.getState().users).toHaveLength(1);
      expect(useStore.getState().users[0].name).toBe('John Doe');

      store.updateUser('u-store-1', { name: 'John Doe Senior' });
      expect(useStore.getState().users[0].name).toBe('John Doe Senior');

      store.removeUser('u-store-1');
      expect(useStore.getState().users[0].is_active).toBe(0);
    });
  });
});
