import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CreditNoteService, CreditNoteServiceError } from '@/lib/services/CreditNoteService';
import { INVOICE_STATUS } from '@/lib/constants';
import { createTestDatabase, cleanupTestDatabase, seedTestData, getTestDatabase } from '../helpers/db';
import crypto from 'crypto';
import db from '@/lib/db';

// Mock the global db module to redirect to test database
vi.mock('@/lib/db', async () => {
  const actualDb = await import('../helpers/db');
  return {
    default: actualDb.getTestDatabase(),
  };
});

describe('CreditNoteService Unit Tests', () => {
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

  it('should throw CreditNoteServiceError when creating a credit note for an already cancelled invoice', () => {
    const adminUserId = 'admin-user';
    const clientId = 'client-1';
    const invoiceId = 'inv-cancelled';

    // 1. Create a client
    testDb.prepare(`INSERT OR IGNORE INTO clients (id, name, email, created_by) VALUES (?, 'Test Client', 'client@test.com', ?)`).run(clientId, adminUserId);

    // 2. Create an already CANCELLED invoice
    testDb.prepare(`
      INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by)
      VALUES (?, 'FAC-CANCELLED', ?, 'Test Client', 'client@test.com', '2026-07-08', 1000, 0, 1000, 180, 0, 10, 1190, ?, ?)
    `).run(invoiceId, clientId, INVOICE_STATUS.CANCELLED, adminUserId);

    // 3. Attempt to create a credit note
    expect(() => {
      CreditNoteService.createCreditNote({
        invoiceId: invoiceId,
        reason: 'Test cancellation',
        items: [
          {
            description: 'Item 1',
            quantity: 1,
            unitPrice: 1190,
          }
        ]
      }, adminUserId);
    }).toThrowError(new CreditNoteServiceError('Cannot create a credit note for an already cancelled invoice', 400));
  });
});
