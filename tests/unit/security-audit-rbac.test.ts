import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { middleware } from '@/middleware';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

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
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('RBAC Middleware', () => {
    it('should block a user (role: "user") from accessing /api/users (admin only)', async () => {
      // Create session for a normal user
      const payload = {
        userId: 'user-123',
        name: 'Normal User',
        role: 'user', // Standard user
        exp: Date.now() + 24 * 60 * 60 * 1000,
      };

      const cookieValue = await createSignedCookie(payload, process.env.SESSION_SECRET as string);

      const request = new NextRequest(new URL('http://localhost/api/users'));
      request.cookies.set('auth_session', cookieValue);

      const response = await middleware(request);

      // Admin API routes should return 403 Forbidden for non-admins
      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.error).toBe('Accès réservé aux administrateurs');
    });

    it('should allow an admin (role: "admin") to access /api/users', async () => {
      // Create session for an admin
      const payload = {
        userId: 'admin-123',
        name: 'Admin User',
        role: 'admin', // Admin user
        exp: Date.now() + 24 * 60 * 60 * 1000,
      };

      const cookieValue = await createSignedCookie(payload, process.env.SESSION_SECRET as string);

      const request = new NextRequest(new URL('http://localhost/api/users'));
      request.cookies.set('auth_session', cookieValue);

      const response = await middleware(request);

      // The middleware should pass (return empty response headers essentially, allowing next handler)
      // NextResponse.next() returns a response with status 200 technically, or we check it doesn't block.
      // Wait, NextResponse.next() technically doesn't change status but it returns a response object
      // let's just check it's not 403 or 401.
      expect(response.status).toBe(200);
      expect(response.headers.get('x-middleware-next')).toBe('1');
    });
  });

  describe('Audit Log Asynchrony', () => {
    it('logAuditAsync should execute asynchronously without blocking', async () => {
      // We'll test this behavior directly or via POST in auth route.
      // Let's import POST and mock logAudit
      const { POST } = await import('@/app/api/auth/login/route');
      const auditApi = await import('@/lib/api/audit');

      const logAuditSpy = vi.spyOn(auditApi, 'logAudit').mockImplementation(() => {});

      // Provide valid environment variables for login route
      process.env.PASSWORD_SALT = 'facturier-gabon-2026';

      const request = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: 'nonexistentuser@example.com',
          password: 'Password123!',
        }),
      });

      // Execute POST request
      const response = await POST(request);

      // The response should be returned (401 because user does not exist)
      expect(response.status).toBe(401);

      // Before timers are run, logAudit should NOT have been called yet because it's in setTimeout(..., 0)
      expect(logAuditSpy).not.toHaveBeenCalled();

      // Run pending timers (setTimeout)
      vi.runAllTimers();

      // Now logAudit should have been called
      expect(logAuditSpy).toHaveBeenCalled();
      expect(logAuditSpy).toHaveBeenCalledWith(
        'LOGIN_FAILED',
        'user',
        null,
        'Tentative de connexion échouée avec: nonexistentuser@example.com',
        null,
        undefined
      );
    });
  });
});
