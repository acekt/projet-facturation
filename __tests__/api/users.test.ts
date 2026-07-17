import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../../app/api/users/route';
import { PATCH, DELETE } from '../../app/api/users/[id]/route';
import * as auth from '../../lib/api/auth';
import db from '../../lib/db';
import { NextResponse } from 'next/server';

// Mock dependancies
vi.mock('../../lib/api/auth', () => ({
  getSession: vi.fn(),
}));

vi.mock('../../lib/db', () => ({
  default: {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue([]),
      run: vi.fn().mockReturnValue({ changes: 1 }),
    }),
  },
}));

// Helper to create Request object
function createMockRequest(body: any, method: string = 'POST') {
  return {
    json: vi.fn().mockResolvedValue(body),
    method,
    url: 'http://localhost/api/users'
  } as unknown as Request;
}

describe('Users API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RBAC (Role-Based Access Control)', () => {
    it('devrait retourner 403 si l\'utilisateur n\'est pas admin', async () => {
      // Mock session as 'user' (opérateur)
      vi.mocked(auth.getSession).mockResolvedValue({
        userId: '1',
        name: 'Test',
        role: 'user',
        exp: 100000
      });

      const res = await GET() as NextResponse;
      expect(res.status).toBe(403);

      const req = createMockRequest({}, 'POST');
      const postRes = await POST(req) as NextResponse;
      expect(postRes.status).toBe(403);
    });

    it('devrait retourner 200 si l\'utilisateur est admin', async () => {
      // Mock session as 'admin'
      vi.mocked(auth.getSession).mockResolvedValue({
        userId: '1',
        name: 'Admin',
        role: 'admin',
        exp: 100000
      });

      const res = await GET() as NextResponse;
      expect(res.status).toBe(200);
    });
  });

  describe('Validation Zod', () => {
    it('devrait rejeter un payload avec un mauvais email ou mot de passe', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({
        userId: '1',
        name: 'Admin',
        role: 'admin',
        exp: 100000
      });

      const req = createMockRequest({
        name: 'Test',
        email: 'invalid-email', // Bad email
        username: 'test',
        role: 'user',
        password: 'weak' // Bad password
      }, 'POST');

      const res = await POST(req) as NextResponse;
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body.error).toBe('Données invalides');
      expect(body.details.fieldErrors.email).toBeDefined();
      expect(body.details.fieldErrors.password).toBeDefined();
    });
  });

  describe('Gestion des Erreurs de Doublons (SQLite)', () => {
    it('devrait intercepter une erreur de doublon SQLite et retourner une erreur 400 propre', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({
        userId: '1',
        name: 'Admin',
        role: 'admin',
        exp: 100000
      });

      const mockRun = vi.fn().mockImplementation(() => {
        const error = new Error('UNIQUE constraint failed: users.username');
        (error as any).code = 'SQLITE_CONSTRAINT_UNIQUE';
        throw error;
      });

      vi.mocked(db.prepare).mockReturnValue({
        run: mockRun,
      } as any);

      const req = createMockRequest({
        name: 'Jean Doublon',
        email: 'doublon@letoile.ga',
        username: 'doublon',
        role: 'user',
        password: 'Password123!'
      }, 'POST');

      const res = await POST(req) as NextResponse;
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe('Un utilisateur avec cet email ou identifiant existe déjà.');
    });
  });

  describe('Métier - Soft Delete', () => {
    it('devrait mettre à jour is_active et deletedAt lors d\'un DELETE', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({
        userId: '1',
        name: 'Admin',
        role: 'admin',
        exp: 100000
      });

      const mockRun = vi.fn().mockReturnValue({ changes: 1 });
      vi.mocked(db.prepare).mockReturnValue({
        run: mockRun,
        all: vi.fn(),
        get: vi.fn(),
        iterate: vi.fn(),
        reader: false,
        source: '',
        database: db,
        pluck: vi.fn().mockReturnThis(),
        expand: vi.fn().mockReturnThis(),
        raw: vi.fn().mockReturnThis(),
        columns: vi.fn().mockReturnValue([]),
        bind: vi.fn().mockReturnThis(),
        safeIntegers: vi.fn().mockReturnThis(),
      } as any);

      // DELETE with id '2' (not self)
      const res = await DELETE({} as Request, { params: Promise.resolve({ id: '2' }) }) as NextResponse;
      expect(res.status).toBe(200);

      // Assert that db.prepare was called with the soft delete query
      expect(db.prepare).toHaveBeenCalledWith('UPDATE users SET is_active = 0, deletedAt = CURRENT_TIMESTAMP WHERE id = ?');
      expect(mockRun).toHaveBeenCalledWith('2');
    });

    it('devrait empêcher la suppression de son propre compte', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({
        userId: '1', // Admin ID
        name: 'Admin',
        role: 'admin',
        exp: 100000
      });

      const res = await DELETE({} as Request, { params: Promise.resolve({ id: '1' }) }) as NextResponse;
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body.error).toBe('Impossible de supprimer votre propre compte');
    });
  });
});
