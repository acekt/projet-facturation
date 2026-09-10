import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/login/route';

process.env.VITEST = 'true';
process.env.PASSWORD_SALT = 'facturier-gabon-2026-fallback-dev-secret-key-32chars!!';
process.env.SESSION_SECRET = 'facturier-gabon-2026-fallback-dev-secret-key-32chars!!';

describe('Performance & Resilience Tests', () => {
  it('should handle 100 simultaneous login attempts without crashing (status 500) and gracefully manage DB load', async () => {
    // 30 seconds timeout for high DB load tests as requested
    const numRequests = 100;

    // Create an array of simultaneous requests
    const promises = Array.from({ length: numRequests }).map(async (_, index) => {
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: `user${index}`, password: 'wrongpassword' }),
      });

      try {
        const response = await POST(req);
        return response.status;
      } catch (error) {
        // If it throws, we catch it to see if the app crashes
        console.error("Crash during POST:", error);
        return 500;
      }
    });

    const results = await Promise.all(promises);

    // Assert that we have exactly 100 results
    expect(results.length).toBe(numRequests);

    // Crucial check: none of the responses should be 500
    // A 500 status would indicate that SQLite threw a BUSY timeout or another unhandled exception
    results.forEach(status => {
      expect(status).not.toBe(500);
    });

    // In this specific scenario with non-existent users or wrong passwords,
    // we expect either 401 (Unauthorized) or maybe 403 (inactive), but mostly 401.
    const has401s = results.some(status => status === 401);
    expect(has401s).toBe(true);

  }, 30000); // Set timeout to 30000ms as instructed
});
