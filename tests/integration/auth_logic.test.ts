import { ROLES, QUOTE_STATUS, INVOICE_STATUS, CLIENT_STATUS } from '@/lib/constants';
import { describe, it, expect } from 'vitest'
import crypto from 'crypto'

const SESSION_SECRET = 'facturier-secret-key-2026-signing';

async function verifySignature(data: string, signature: string) {
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64');
  return signature === expected;
}

describe('Auth Security', () => {
  it('should verify valid signatures', async () => {
    const data = btoa(JSON.stringify({ role: ROLES.ADMIN }));
    const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64');
    expect(await verifySignature(data, sig)).toBe(true);
  });
});
