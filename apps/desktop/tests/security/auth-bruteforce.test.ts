import { describe, it, expect } from 'vitest';
import { loginUser } from '@/app/actions/auth.actions';

process.env.VITEST = 'true';
process.env.PASSWORD_SALT = 'facturier-gabon-2026-fallback-dev-secret-key-32chars!!';
process.env.SESSION_SECRET = 'facturier-gabon-2026-fallback-dev-secret-key-32chars!!';

describe('Performance & Resilience Tests', () => {
  it('should handle 100 simultaneous login attempts (Brute Force) without crashing or DB lock', async () => {
    const NUM_REQUESTS = 100;

    // Simulate 100 concurrent login requests
    const requestPromises = Array.from({ length: NUM_REQUESTS }).map(async (_, index) => {
      try {
        const response = await loginUser({ username: `hacker${index}`, password: 'bruteforcepassword' });
        return response.success ? 200 : 401;
      } catch (error) {
        console.error("Application crashed during loginUser:", error);
        return 500;
      }
    });

    const results = await Promise.all(requestPromises);

    expect(results.length).toBe(NUM_REQUESTS);

    // Better-SQLite3 handles BUSY timeouts natively. No crash (500).
    results.forEach(status => {
      expect(status).not.toBe(500);
    });

    // All should be rejected with 401
    const allRejected = results.every(status => status === 401);
    expect(allRejected).toBe(true);

  }, 30000);
});
