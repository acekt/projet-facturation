import { describe, it, expect } from 'vitest';
import { loginUser } from '@/app/actions/auth.actions';

process.env.VITEST = 'true';
process.env.PASSWORD_SALT = 'facturier-gabon-2026-fallback-dev-secret-key-32chars!!';
process.env.SESSION_SECRET = 'facturier-gabon-2026-fallback-dev-secret-key-32chars!!';

describe('Performance & Resilience Tests', () => {
  it('should handle 100 simultaneous login attempts without crashing (status 500) and gracefully manage DB load', async () => {
    const numRequests = 100;

    const promises = Array.from({ length: numRequests }).map(async (_, index) => {
      try {
        const response = await loginUser({ username: `user${index}`, password: 'wrongpassword' });
        return response.success ? 200 : 401;
      } catch (error) {
        console.error("Crash during loginUser:", error);
        return 500;
      }
    });

    const results = await Promise.all(promises);

    expect(results.length).toBe(numRequests);

    // Crucial check: none of the responses should be 500 (no DB lock)
    results.forEach(status => {
      expect(status).not.toBe(500);
    });

    const has401s = results.some(status => status === 401);
    expect(has401s).toBe(true);

  }, 30000);
});
