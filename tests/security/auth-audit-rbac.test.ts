import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { POST } from '@/app/api/auth/login/route';
import { signSession } from '@/lib/api/auth';
import * as auditApi from '@/lib/api/audit';

process.env.VITEST = 'true';
process.env.PASSWORD_SALT = 'facturier-gabon-2026-fallback-dev-secret-key-32chars!!';
process.env.SESSION_SECRET = 'facturier-gabon-2026-fallback-dev-secret-key-32chars!!';

vi.mock('@/lib/api/audit', () => ({
  logAudit: vi.fn(),
}));

describe('Unit Tests (Audit & RBAC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Audit Logging Asynchrony', () => {
    it('should execute logAuditAsync in background without blocking the main request resolution', async () => {
      vi.useFakeTimers();

      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'nonexistent', password: 'password123' }),
      });

      const responsePromise = POST(req);
      const response = await responsePromise;

      // The main request resolves immediately without blocking
      expect(response.status).toBe(401);

      // Verify that the background task hasn't executed yet (setTimeout 0 hasn't fired in the event loop)
      expect(auditApi.logAudit).not.toHaveBeenCalled();

      // Run timers to execute the background audit log task
      await vi.runAllTimersAsync();

      // Verify the log was finally executed
      expect(auditApi.logAudit).toHaveBeenCalledWith(
        'LOGIN_FAILED',
        'user',
        null,
        'Tentative de connexion échouée',
        null,
        null
      );

      vi.useRealTimers();
    });
  });

  describe('RBAC Middleware Guards', () => {
    it('should reject a standard user accessing admin routes with 403 Forbidden', async () => {
      // Create session for a standard user
      const sessionData = JSON.stringify({ userId: 'user1', name: 'Standard User', role: 'user', exp: Date.now() + 10000 });
      const base64Data = Buffer.from(sessionData).toString('base64');
      const signedCookie = await signSession(base64Data);

      const req = new NextRequest('http://localhost/api/users', {
        headers: new Headers({
          Cookie: `auth_session=${signedCookie}`,
        }),
      });

      const res = await middleware(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Accès réservé aux administrateurs');
    });

    it('should allow an admin user to access admin routes', async () => {
      // Create session for an admin
      const sessionData = JSON.stringify({ userId: 'admin1', name: 'Admin', role: 'admin', exp: Date.now() + 10000 });
      const base64Data = Buffer.from(sessionData).toString('base64');
      const signedCookie = await signSession(base64Data);

      const req = new NextRequest('http://localhost/api/users', {
        headers: new Headers({
          Cookie: `auth_session=${signedCookie}`,
        }),
      });

      const res = await middleware(req);
      expect(res.status).not.toBe(403);
      expect(res.headers.get('x-middleware-next')).toBe('1');
    });
  });
});
