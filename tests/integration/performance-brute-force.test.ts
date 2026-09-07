import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

describe('Performance & Resilience Tests', () => {
  beforeAll(() => {
    process.env.PASSWORD_SALT = 'facturier-gabon-2026';
    process.env.SESSION_SECRET = 'facturier-secret-key-2026-signing-32chars';
  });

  it('should handle 100 simultaneous brute-force login attempts without crashing or returning 500 (DB BUSY timeout test)', async () => {
    // Dynamic import to avoid loading db before environment is set
    const { POST } = await import('@/app/api/auth/login/route');

    const totalRequests = 100;
    const requests = Array.from({ length: totalRequests }).map((_, i) => {
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: `bruteforce${i}@example.com`,
          password: 'Password123!',
        }),
      });
      return POST(req);
    });

    const start = Date.now();
    const responses = await Promise.all(requests);
    const end = Date.now();

    // We expect the responses to be 401 Unauthorized (because users do not exist)
    // The key is that they shouldn't be 500 (which would happen if DB locks up)

    let error500Count = 0;
    let unauthorizedCount = 0;

    for (const response of responses) {
      if (response.status === 500) {
        error500Count++;
      } else if (response.status === 401) {
        unauthorizedCount++;
      }
    }

    // Output stats
    console.log(`Processed ${totalRequests} requests in ${end - start}ms`);
    console.log(`500 Errors: ${error500Count}, 401 Errors: ${unauthorizedCount}`);

    // Assert that the application did not crash or throw 500 errors
    expect(error500Count).toBe(0);
    expect(unauthorizedCount).toBe(totalRequests);
  }, 10000); // Give it a bit more time for the 100 requests to process
});
