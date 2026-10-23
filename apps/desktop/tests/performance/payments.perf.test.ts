import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET } from '@/app/api/payments/route';
import { createTestDatabase, cleanupTestDatabase, seedTestData, getTestDatabase } from '../helpers/db';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import crypto from 'crypto';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/db', async () => {
  const actualDb = await import('../helpers/db');
  return {
    default: actualDb.getTestDatabase(),
  };
});

describe('Payments API Performance Tests', () => {
  let testDb: ReturnType<typeof createTestDatabase>;
  let originalPrepare: any;
  let queryCount = 0;

  beforeEach(() => {
    testDb = createTestDatabase();
    seedTestData(testDb);
    vi.clearAllMocks();

    originalPrepare = testDb.prepare.bind(testDb);
    queryCount = 0;
    testDb.prepare = ((sql: string) => {
      queryCount++;
      return originalPrepare(sql);
    }) as any;
  });

  afterEach(() => {
    testDb.prepare = originalPrepare;
    cleanupTestDatabase();
    vi.restoreAllMocks();
  });

  it('should fetch 5000 payments without N+1 queries and within memory limits', async () => {
    const adminSession = {
      userId: 'admin-user',
      role: 'admin',
      name: 'Admin',
      username: 'admin',
    };
    vi.mocked(getSession).mockResolvedValue(adminSession);

    // Seed 5000 payments
    const clientId = 'client-perf';
    const invoiceId = 'inv-perf';

    // Insert prerequisite data using the mocked prepare to avoid counting these in the final tally (we will reset count)
    testDb.prepare(`INSERT OR IGNORE INTO clients (id, name, email, created_by) VALUES (?, 'Perf Client', 'client@perf.com', ?)`).run(clientId, adminSession.userId);
    testDb.prepare(`
      INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by)
      VALUES (?, 'FAC-PERF', ?, 'Perf Client', 'client@perf.com', '2026-07-08', 1000, 0, 1000, 180, 0, 10, 1190, 'UNPAID', ?)
    `).run(invoiceId, clientId, adminSession.userId);

    const insertPayment = originalPrepare(`
      INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, created_by)
      VALUES (?, ?, 10, 'cash', '2026-07-08', 'REF', ?)
    `);

    // Bulk insert using transaction for speed
    const seedPayments = testDb.transaction(() => {
      for (let i = 0; i < 5000; i++) {
        insertPayment.run(`pay-perf-${i}`, invoiceId, adminSession.userId);
      }
    });
    seedPayments();

    // Reset query count before hitting the API
    queryCount = 0;

    // Record initial memory
    global.gc && global.gc(); // force GC if available (needs --expose-gc flag, but best effort)
    const initialMemory = process.memoryUsage().heapUsed;

    // Hit the API
    const req = new Request('http://localhost/api/payments', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024;

    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(5000);

    // Assert NO N+1 Queries (Should be < 5 queries total for the entire GET request)
    expect(queryCount).toBeLessThan(5);

    // Assert memory increase is less than 50MB
    expect(memoryIncreaseMB).toBeLessThan(50);

    console.log(`Memory Increase: ${memoryIncreaseMB.toFixed(2)} MB`);
    console.log(`Queries Executed: ${queryCount}`);
  });
});
