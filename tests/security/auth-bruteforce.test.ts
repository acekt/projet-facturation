import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/login/route';

process.env.VITEST = 'true';
process.env.PASSWORD_SALT = 'facturier-gabon-2026-fallback-dev-secret-key-32chars!!';
process.env.SESSION_SECRET = 'facturier-gabon-2026-fallback-dev-secret-key-32chars!!';

describe('Performance & Resilience Tests', () => {
  it('should handle 100 simultaneous login attempts (Brute Force) without crashing (status 500) or DB lock', async () => {
    // We set a large timeout of 30s to allow SQLite to handle the concurrency
    const NUM_REQUESTS = 100;

    // Simulate 100 concurrent POST requests
    const requestPromises = Array.from({ length: NUM_REQUESTS }).map(async (_, index) => {
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: `hacker${index}`, password: 'bruteforcepassword' }),
      });

      try {
        const response = await POST(req);
        return response.status;
      } catch (error) {
        console.error("Application crashed during POST request:", error);
        return 500;
      }
    });

    const results = await Promise.all(requestPromises);

    expect(results.length).toBe(NUM_REQUESTS);

    // Better-SQLite3 handles BUSY timeouts natively if correctly configured.
    // We must verify that no request returned a 500 Internal Server Error,
    // which would mean the database was locked or the app crashed.
    results.forEach(status => {
      expect(status).not.toBe(500);
    });

    // Since the users don't exist, we expect 401 Unauthorized errors
    const has401 = results.some(status => status === 401);
    expect(has401).toBe(true);

  }, 30000); // 30 seconds timeout
});
