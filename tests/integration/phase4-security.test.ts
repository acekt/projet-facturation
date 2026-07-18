import { ROLES, QUOTE_STATUS, INVOICE_STATUS, CLIENT_STATUS } from '@/lib/constants';
import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createTestDatabase, seedTestData, cleanupTestDatabase, getTestDatabase } from '../helpers/db';

// Mock global db for API routes (must be before API route imports)
vi.mock('@/lib/db', () => ({
  default: getTestDatabase(),
}));

import { middleware } from '@/middleware';
import { POST as POSTLogin } from '@/app/api/auth/login/route';

// Helper to sign a session cookie using Web Crypto API (HMAC SHA-256) matching middleware format
async function createSignedSessionCookie(payload: Record<string, any>, secret: string): Promise<string> {
  const data = btoa(JSON.stringify(payload));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${data}.${base64Signature}`;
}

describe('🚨 PHASE 4/10 : AUDIT TDD — AUTHENTIFICATION & SÉCURITÉ (HMAC, RBAC, FAIL-FAST) 🚨', () => {
  const VALID_SECRET = 'super-secret-key-for-phase4-security-tests-32-chars!!';
  let originalSessionSecret: string | undefined;
  let originalPasswordSalt: string | undefined;
  let testDb: ReturnType<typeof createTestDatabase>;

  beforeAll(() => {
    originalSessionSecret = process.env.SESSION_SECRET;
    originalPasswordSalt = process.env.PASSWORD_SALT;
  });

  beforeEach(() => {
    process.env.SESSION_SECRET = VALID_SECRET;
    process.env.PASSWORD_SALT = 'salt-for-phase4-test-16c';
    testDb = createTestDatabase();
    seedTestData(testDb);
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSessionSecret;
    process.env.PASSWORD_SALT = originalPasswordSalt;
    cleanupTestDatabase();
  });

  // ==========================================================================
  // SCÉNARIO 1 : INTÉGRITÉ CRYPTOGRAPHIQUE (HMAC SHA-256)
  // ==========================================================================
  describe('1. Intégrité Cryptographique (HMAC - middleware)', () => {
    it('devrait rejeter un cookie falsifié ou à signature invalide avec une erreur 401', async () => {
      // Cookie avec signature falsifiée
      const forgedCookie = 'eyJ1c2VySWQiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OTk5OX0=.badSignatureBase64';

      const req = new NextRequest('http://localhost/api/users', {
        headers: {
          cookie: `auth_session=${forgedCookie}`,
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toContain('Unauthorized');
    });

    it('devrait rejeter un cookie signé avec une clé secrète différente (401)', async () => {
      const wrongSecret = 'wrong-secret-key-different-from-valid-secret-key!!';
      const payload = {
        userId: 'admin-id',
        role: ROLES.ADMIN,
        exp: Date.now() + 3600_000,
      };
      const cookieSignedWithWrongSecret = await createSignedSessionCookie(payload, wrongSecret);

      const req = new NextRequest('http://localhost/api/users', {
        headers: {
          cookie: `auth_session=${cookieSignedWithWrongSecret}`,
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // SCÉNARIO 2 : CONTRÔLE D'ACCÈS BASÉ SUR LES RÔLES (RBAC)
  // ==========================================================================
  describe('2. Contrôle d\'Accès Basé sur les Rôles (RBAC - middleware)', () => {
    it('devrait interdire à un utilisateur operator ou user d\'accéder aux routes admin (/api/users)', async () => {
      const operatorPayload = {
        userId: 'operator-id',
        role: 'operator',
        name: 'Opérateur Test',
        exp: Date.now() + 3600_000,
      };
      const validCookie = await createSignedSessionCookie(operatorPayload, VALID_SECRET);

      const req = new NextRequest('http://localhost/api/users', {
        headers: {
          cookie: `auth_session=${validCookie}`,
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('Accès réservé aux administrateurs');
    });

    it('devrait autoriser un administrateur valide à accéder aux routes admin', async () => {
      const adminPayload = {
        userId: 'admin-id',
        role: ROLES.ADMIN,
        name: 'Admin Test',
        exp: Date.now() + 3600_000,
      };
      const validCookie = await createSignedSessionCookie(adminPayload, VALID_SECRET);

      const req = new NextRequest('http://localhost/api/users', {
        headers: {
          cookie: `auth_session=${validCookie}`,
        },
      });

      const res = await middleware(req);
      // NextResponse.next() renvoie le statut 200 par défaut dans le middleware
      expect(res.status).toBe(200);
    });
  });

  // ==========================================================================
  // SCÉNARIO 3 : GRACEFUL DEGRADATION (FAIL-FAST 503 SERVICE UNAVAILABLE)
  // ==========================================================================
  describe('3. Graceful Degradation (Fail Fast 503 - Secret manquant ou < 32 chars)', () => {
    it('devrait retourner 503 JSON propre dans le middleware si SESSION_SECRET est absent ou trop court', async () => {
      process.env.SESSION_SECRET = 'trop-court'; // < 32 caractères

      const req = new NextRequest('http://localhost/api/invoices');
      const res = await middleware(req);

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toContain('Configuration serveur invalide');
    });

    it('devrait retourner 503 JSON propre sur la route login si SESSION_SECRET est absent ou trop court', async () => {
      process.env.SESSION_SECRET = 'trop-court';

      const loginReq = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'password123',
        }),
      });

      const res = await POSTLogin(loginReq);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toContain('Configuration serveur invalide');
    });
  });

  // ==========================================================================
  // SCÉNARIO 4 : LOGIQUE DE CONNEXION (BCRYPT & COOKIE SÉCURISÉ)
  // ==========================================================================
  describe('4. Logique de Connexion (Login route & authentification)', () => {
    it('devrait rejeter une tentative de connexion avec un mot de passe invalide en 401', async () => {
      // Dans seedTestData, le user admin existe avec username="admin"
      const loginReq = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'mauvais_mot_de_passe',
        }),
      });

      const res = await POSTLogin(loginReq);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Identifiants invalides');
    });

    it('devrait rejeter une tentative de connexion avec un utilisateur inexistant en 401', async () => {
      const loginReq = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'utilisateur_fantome',
          password: 'password123',
        }),
      });

      const res = await POSTLogin(loginReq);
      expect(res.status).toBe(401);
    });

    it('devrait réussir la connexion avec des identifiants valides et poser le cookie HttpOnly', async () => {
      // Créer un utilisateur avec un mot de passe connu hashé en bcrypt
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('secret_gabon_2026', 10);

      testDb.prepare(`
        INSERT OR REPLACE INTO users (id, username, email, password, name, role, is_active, force_password_change, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('sec-user-1', 'secuser', 'sec@test.ga', hash, 'Sec User', 'user', 1, 0, new Date().toISOString());

      const loginReq = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'secuser',
          password: 'secret_gabon_2026',
        }),
      });

      const res = await POSTLogin(loginReq);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.user.username).toBe('secuser');

      // Vérifier le Set-Cookie
      const setCookieHeader = res.headers.get('set-cookie');
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toContain('auth_session=');
      expect(setCookieHeader).toContain('HttpOnly');
    });
  });
});
