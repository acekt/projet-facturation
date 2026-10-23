import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';

process.env.PASSWORD_SALT = 'facturier-gabon-2026';
process.env.SESSION_SECRET = 'facturier-secret-key-2026-signing-32chars';

describe('Authentication Performance & Resilience', () => {
  it('should handle 100 simultaneous login attempts without Better-SQLite3 locking or Next.js crashing', async () => {
    const attempts = 100;
    const requests = Array.from({ length: attempts }).map((_, i) => {
      const request = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: `user${i}@example.com`,
          password: 'WrongPassword123!',
        }),
      });
      return POST(request);
    });

    const responses = await Promise.all(requests);

    // Check that all responses completed and are 401 Unauthorized (because passwords/users are wrong)
    expect(responses.length).toBe(attempts);
    for (const response of responses) {
      expect(response.status).toBe(401);
    }
  }, 15000); // give it generous timeout
});
