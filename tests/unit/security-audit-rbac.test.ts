
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { middleware } from '@/middleware';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { POST } from '@/app/api/auth/login/route';
import * as auditApi from '@/lib/api/audit';

// Setup environment variable for test
process.env.SESSION_SECRET = 'facturier-secret-key-2026-signing-32chars';
process.env.VITEST = 'true';

async function createSignedCookie(payload: any, secret: string) {
  const data = btoa(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data)
  );

  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${data}.${base64Signature}`;
}

describe('Security Audit & RBAC Tests', () => {

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('RBAC Middleware', () => {
    it('should block a user (role: "user") from accessing /api/users (admin only)', async () => {
      const payload = {
        userId: 'user-123',
        name: 'Normal User',
        role: 'user',
        exp: Date.now() + 24 * 60 * 60 * 1000,
      };

      const cookieValue = await createSignedCookie(payload, process.env.SESSION_SECRET as string);
      const request = new NextRequest(new URL('http://localhost/api/users'));
      request.cookies.set('auth_session', cookieValue);

      const response = await middleware(request);
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe('Accès réservé aux administrateurs');
    });

    it('should allow an admin (role: "admin") to access /api/users', async () => {
      const payload = {
        userId: 'admin-123',
        name: 'Admin User',
        role: 'admin',
        exp: Date.now() + 24 * 60 * 60 * 1000,
      };

      const cookieValue = await createSignedCookie(payload, process.env.SESSION_SECRET as string);
      const request = new NextRequest(new URL('http://localhost/api/users'));
      request.cookies.set('auth_session', cookieValue);

      const response = await middleware(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('x-middleware-next')).toBe('1');
    });
  });

  describe('Audit Log Asynchrony', () => {
    beforeEach(() => {
        vi.useFakeTimers({
            toFake: ['setTimeout']
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('logAuditAsync should execute asynchronously without blocking', async () => {
      const logAuditSpy = vi.spyOn(auditApi, 'logAudit').mockImplementation(() => {});
      process.env.PASSWORD_SALT = 'facturier-gabon-2026';

      const request = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: 'nonexistentuser@example.com',
          password: 'Password123!',
        }),
      });

      // Execute POST request. It should return quickly because it doesn't await the timeout.
      const response = await POST(request);
      expect(response.status).toBe(401);

      // We expect the logAudit call not to have happened synchronously.
      // Because we used fake timers, setTimeout(..., 0) has not fired yet.
      expect(logAuditSpy).not.toHaveBeenCalled();

      // Run pending timers (setTimeout) to trigger the async logs
      vi.runAllTimers();

      // Now logAudit should have been called
      expect(logAuditSpy).toHaveBeenCalled();
      expect(logAuditSpy).toHaveBeenCalledWith(
        'LOGIN_FAILED',
        'user',
        null,
        'Tentative de connexion échouée (mauvais mot de passe) pour: nonexistentuser@example.com',
        null,
        null
      );
    });
  });
});
