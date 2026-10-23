import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { updateInvoiceStatus } from '@/lib/api/invoice-logic';
import { INVOICE_STATUS } from '@/lib/constants';
import { createTestDatabase, cleanupTestDatabase, seedTestData, getTestDatabase } from '../helpers/db';

// Mock the global db module to redirect to test database
vi.mock('@/lib/db', async () => {
  const actualDb = await import('../helpers/db');
  return {
    default: actualDb.getTestDatabase(),
  };
});

describe('Invoice Status Logic Unit Tests (Specific Requirements)', () => {
  let testDb: ReturnType<typeof createTestDatabase>;

  beforeEach(() => {
    testDb = createTestDatabase();
    seedTestData(testDb);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDatabase();
    vi.restoreAllMocks();
  });

  it('should transition a 1000 XAF invoice to PAID (PAYE) with a 1000 XAF payment', () => {
    const adminUserId = 'admin-user';
    const clientId = 'client-1';
    const invoiceId = 'inv-1000-full';

    testDb.prepare(`INSERT OR IGNORE INTO clients (id, name, email, created_by) VALUES (?, 'Test Client', 'client@test.com', ?)`).run(clientId, adminUserId);

    testDb.prepare(`
      INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by)
      VALUES (?, 'FAC-1000-FULL', ?, 'Test Client', 'client@test.com', '2026-07-08', 840, 0, 840, 151, 0, 9, 1000, ?, ?)
    `).run(invoiceId, clientId, INVOICE_STATUS.UNPAID, adminUserId);

    // 1000 XAF payment
    testDb.prepare(`
      INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, created_by)
      VALUES ('pay-1000', ?, 1000, 'cash', '2026-07-08', 'REF', ?)
    `).run(invoiceId, adminUserId);

    const newStatus = updateInvoiceStatus(invoiceId);
    expect(newStatus).toBe(INVOICE_STATUS.PAID);
  });

  it('should transition a 1000 XAF invoice to PARTIALLY_PAID (PARTIEL) with a 500 XAF payment', () => {
    const adminUserId = 'admin-user';
    const clientId = 'client-1';
    const invoiceId = 'inv-1000-partial';

    testDb.prepare(`INSERT OR IGNORE INTO clients (id, name, email, created_by) VALUES (?, 'Test Client', 'client@test.com', ?)`).run(clientId, adminUserId);

    testDb.prepare(`
      INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by)
      VALUES (?, 'FAC-1000-PART', ?, 'Test Client', 'client@test.com', '2026-07-08', 840, 0, 840, 151, 0, 9, 1000, ?, ?)
    `).run(invoiceId, clientId, INVOICE_STATUS.UNPAID, adminUserId);

    // 500 XAF payment
    testDb.prepare(`
      INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, created_by)
      VALUES ('pay-500', ?, 500, 'cash', '2026-07-08', 'REF', ?)
    `).run(invoiceId, adminUserId);

    const newStatus = updateInvoiceStatus(invoiceId);
    expect(newStatus).toBe(INVOICE_STATUS.PARTIALLY_PAID);
  });
});
