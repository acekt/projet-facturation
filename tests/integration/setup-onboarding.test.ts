import { ROLES, QUOTE_STATUS, INVOICE_STATUS, CLIENT_STATUS } from '@/lib/constants';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDatabase, cleanupTestDatabase, getTestDatabase } from '../helpers/db';

vi.mock('@/lib/db', () => ({
  default: getTestDatabase(),
}));

// Mock next/navigation for server components
const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

import { POST as POSTSetup } from '@/app/api/setup/route';
import LoginPage from '@/app/login/page';
import SetupPage from '@/app/setup/page';

describe('🚨 MISSION ARCHITECTURE : FLUX D\'INITIALISATION (FIRST-RUN SETUP) 🚨', () => {
  let testDb: ReturnType<typeof createTestDatabase>;
  const VALID_SECRET = 'super-secret-key-for-setup-tests-32-chars!!';
  let originalSessionSecret: string | undefined;

  beforeEach(() => {
    originalSessionSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = VALID_SECRET;
    mockRedirect.mockReset();
    testDb = createTestDatabase();
    // Do NOT call seedTestData(testDb) by default because we want to test empty database first!
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSessionSecret;
    cleanupTestDatabase();
  });

  describe('1. Route API transactionnelle POST /api/setup', () => {
    it('devrait initialiser le premier administrateur, les paramètres et retourner un cookie de session quand la base est vierge', async () => {
      // Vérification initiale : 0 utilisateur
      const countBefore = (testDb.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
      expect(countBefore).toBe(0);

      const setupPayload = {
        name: 'Admin Gabon',
        email: 'admin@facturier.ga',
        password: 'Password123!',
        phone: '+241 01 02 03 04',
        companyName: 'L\'Facturier S.A.',
        nif: '123456NIF',
        rccm: 'GA-LBV-2026-B01',
        address: 'Quartier Louis, Libreville',
        companyPhone: '+241 01 00 00 00',
        companyEmail: 'contact@facturier.ga',
      };

      const req = new Request('http://localhost:3000/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupPayload),
      });

      const res = await POSTSetup(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.user.role).toBe('admin');
      expect(data.user.email).toBe('admin@facturier.ga');

      // Vérification en base de données
      const userInDb = testDb.prepare('SELECT * FROM users WHERE email = ?').get('admin@facturier.ga') as any;
      expect(userInDb).toBeDefined();
      expect(userInDb.role).toBe('admin');
      expect(userInDb.is_active).toBe(1);

      const settingsInDb = testDb.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
      expect(settingsInDb).toBeDefined();
      expect(settingsInDb.companyName).toBe('L\'Facturier S.A.');
      expect(settingsInDb.nif).toBe('123456NIF');
      expect(settingsInDb.tvaRate).toBe(18.0);

      // Vérification du cookie auth_session
      const setCookieHeader = res.headers.get('set-cookie');
      expect(setCookieHeader).toContain('auth_session=');

      // Vérification de l'audit
      const auditLog = testDb.prepare("SELECT * FROM audit_logs WHERE details LIKE '%FIRST_RUN_SETUP%'").get() as any;
      expect(auditLog).toBeDefined();
      expect(auditLog.action).toBe('CREATE');
      expect(auditLog.details).toContain('L\'Facturier S.A.');
    });

    it('devrait retourner 403 Forbidden dès qu\'un utilisateur existe dans la base (`count > 0`)', async () => {
      // On insère un utilisateur dans la base
      testDb.prepare(`
        INSERT INTO users (id, username, email, password, name, role, is_active)
        VALUES ('existing-id', 'existing@facturier.ga', 'existing@facturier.ga', 'hashed', 'Existing User', 'admin', 1)
      `).run();

      const setupPayload = {
        name: 'Hacker Attempt',
        email: 'hacker@facturier.ga',
        password: 'Password123!',
        companyName: 'Fake Company',
      };

      const req = new Request('http://localhost:3000/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupPayload),
      });

      const res = await POSTSetup(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe("L'application est déjà initialisée. Configuration interdite.");

      // Vérifier qu'aucun nouvel utilisateur n'a été inséré
      const countAfter = (testDb.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
      expect(countAfter).toBe(1);
    });

    it('devrait retourner 400 si les données de configuration sont incomplètes', async () => {
      const setupPayload = {
        name: 'Admin sans entreprise',
        email: 'admin@facturier.ga',
        password: '123', // trop court
        companyName: '', // vide requis
      };

      const req = new Request('http://localhost:3000/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupPayload),
      });

      const res = await POSTSetup(req);
      expect(res.status).toBe(400);
    });
  });

  describe('2. Sécurité & Redirections Serveur (Server Components Guard)', () => {
    it('LoginPage devrait rediriger vers /setup si la table users est vide (`userCount === 0`)', async () => {
      const count = (testDb.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
      expect(count).toBe(0);

      await LoginPage();
      expect(mockRedirect).toHaveBeenCalledWith('/setup');
    });

    it('SetupPage devrait rediriger vers /login si un compte existe (`userCount > 0`)', async () => {
      testDb.prepare(`
        INSERT INTO users (id, username, email, password, name, role, is_active)
        VALUES ('admin-id', 'admin@facturier.ga', 'admin@facturier.ga', 'hashed', 'Admin', 'admin', 1)
      `).run();

      await SetupPage();
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });
  });
});
