import { INVOICE_STATUS, ROLES } from '@/lib/constants';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDatabase, seedTestData, cleanupTestDatabase, createAuthenticatedSession, getTestDatabase } from '../helpers/db';
import { DELETE as DELETECreditNote } from '@/app/api/credit-notes/[id]/route';
import { getSession } from '@/lib/api/auth';
import { CreditNoteService } from '@/lib/services/CreditNoteService';

// Mock the global db module to redirect to test database
vi.mock('@/lib/db', () => ({
  default: getTestDatabase(),
}));

// Mock the getSession function
vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

describe('AN-6: Soft delete credit note in transaction', () => {
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

  it('should soft delete credit note and recalculate invoice status correctly based on actual payments', async () => {
    const adminSession = createAuthenticatedSession('admin');
    vi.mocked(getSession).mockResolvedValue(adminSession);

    // 1. Create a client and an invoice
    testDb.prepare(`INSERT OR IGNORE INTO clients (id, name, email, created_by) VALUES ('client-1', 'Test Client', 'client@test.com', 'admin-user')`).run();

    testDb.prepare(`
      INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by)
      VALUES ('inv-1', 'FAC-001', 'client-1', 'Test Client', 'client@test.com', '2026-07-08', 100000, 0, 100000, 18000, 0, 1000, 119000, 'UNPAID', 'admin-user')
    `).run();

    // 2. Add a partial payment
    testDb.prepare(`
      INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, created_by)
      VALUES ('pay-1', 'inv-1', 50000, 'virement', '2026-07-09', 'REF-001', 'admin-user')
    `).run();

    // Verify invoice status updates to PARTIALLY_PAID using the logic (for setup)
    testDb.prepare("UPDATE invoices SET status = 'PARTIALLY_PAID' WHERE id = 'inv-1'").run();

    let invoice = testDb.prepare('SELECT * FROM invoices WHERE id = ?').get('inv-1') as any;
    expect(invoice.status).toBe('PARTIALLY_PAID');

    // 3. Create a credit note for the entire invoice (should cancel the invoice per AN-5)
    const result = CreditNoteService.createCreditNote({
      invoiceId: 'inv-1',
      reason: 'Erreur',
      items: [
        {
          description: 'Remboursement total',
          quantity: 1,
          unitPrice: 119000,
        }
      ]
    }, 'admin-user');

    const creditNoteId = result.id;

    // Verify invoice is cancelled
    invoice = testDb.prepare('SELECT * FROM invoices WHERE id = ?').get('inv-1') as any;
    expect(invoice.status).toBe('cancelled');

    // 4. Soft delete the credit note
    const req = new Request(`http://localhost/api/credit-notes/${creditNoteId}`, {
      method: 'DELETE',
    });

    const res = await DELETECreditNote(req, { params: Promise.resolve({ id: creditNoteId }) });
    expect(res.status).toBe(200);

    // 5. Verify the credit note is soft deleted
    const cnRecord = testDb.prepare('SELECT * FROM credit_notes WHERE id = ?').get(creditNoteId) as any;
    expect(cnRecord).toBeDefined();
    expect(cnRecord.deletedAt).not.toBeNull();
    expect(cnRecord.status).toBe('cancelled');

    // 6. AN-6 VERIFICATION: Verify the invoice status was correctly recalculated based on payments
    // It should NOT be UNPAID, it should be PARTIALLY_PAID because there is a 50000 payment
    invoice = testDb.prepare('SELECT * FROM invoices WHERE id = ?').get('inv-1') as any;
    expect(invoice.status).toBe('PARTIALLY_PAID');
  });
});
