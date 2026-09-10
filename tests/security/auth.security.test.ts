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

describe('Security & RBAC Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Audit Logging', () => {
    it('should execute logAuditAsync in background without blocking the main request', async () => {
      vi.useFakeTimers();

      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'nonexistent', password: 'password123' }),
      });

      const responsePromise = POST(req);
      const response = await responsePromise;

      expect(response.status).toBe(401);

      // Before timers run, the log should not be called due to setTimeout 0
      expect(auditApi.logAudit).not.toHaveBeenCalled();

      // Run timers to execute the background task
      await vi.runAllTimersAsync();

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

  describe('RBAC Middleware', () => {
    it('should return 403 for standard user accessing admin routes', async () => {
      const sessionData = JSON.stringify({ userId: 'user1', name: 'Test User', role: 'user', exp: Date.now() + 10000 });
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

    it('should allow admin user to access admin routes', async () => {
      const sessionData = JSON.stringify({ userId: 'admin1', name: 'Admin', role: 'admin', exp: Date.now() + 10000 });
      const base64Data = Buffer.from(sessionData).toString('base64');
      const signedCookie = await signSession(base64Data);

      const req = new NextRequest('http://localhost/api/users', {
        headers: new Headers({
          Cookie: `auth_session=${signedCookie}`,
        }),
      });

      const res = await middleware(req);
      // NextResponse.next() doesn't have a status on the response object directly in testing sometimes unless modified,
      // but it does not return 403.
      expect(res.status).not.toBe(403);
      expect(res.headers.get('x-middleware-next')).toBe('1');
    });
  });
});
