import { ROLES, QUOTE_STATUS, INVOICE_STATUS, CLIENT_STATUS } from '@/lib/constants';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDatabase, seedTestData, cleanupTestDatabase, createAuthenticatedSession, getTestDatabase } from '../helpers/db';
import crypto from 'crypto';
import { getSession } from '@/lib/api/auth';
import { POST as POSTQuote } from '@/app/api/quotes/route';
import { POST as POSTQuoteConvert } from '@/app/api/quotes/convert/route';
import { POST as POSTPayment } from '@/app/api/payments/route';
import { DELETE as DELETEPayment } from '@/app/api/payments/[id]/route';

// Mock the global db module to redirect to test database (must be before API route imports)
vi.mock('@/lib/db', () => ({
  default: getTestDatabase(),
}));

// Mock the getSession function
vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

describe('Integration Test - End-to-End Financial Flow', () => {
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

  function getTestClientId(): string {
    const client = testDb.prepare('SELECT id FROM clients LIMIT 1').get() as { id: string } | undefined;
    if (!client) {
      throw new Error('No client found in test database');
    }
    return client.id;
  }

  it('should execute the full financial flow correctly', async () => {
    // 1. Create a quote as a User
    const userSession = createAuthenticatedSession('user');
    vi.mocked(getSession).mockResolvedValue(userSession);

    const clientId = getTestClientId();
    const quotePayload = {
      clientId: clientId,
      clientName: 'Test Client',
      clientEmail: 'client@test.com',
      date: '2026-06-08',
      dueDate: '2026-07-08',
      subtotal: 10000,
      discount: 0,
      taxBase: 10100, // netHT + cssAmount (1% of 10000 = 100)
      tvaAmount: 1818, // 18% of 10100
      tpsAmount: 960,  // 9.5% of 10100 -> Math.round(959.5) = 960
      cssAmount: 100,
      total: 12878,    // 10100 + 1818 + 960 = 12878
      status: QUOTE_STATUS.EN_ATTENTE,
      items: [
        {
          description: 'Web development services',
          quantity: 1,
          unitPrice: 10000,
          total: 10000,
        }
      ]
    };

    const createQuoteReq = new Request('http://localhost/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quotePayload),
    });

    const createQuoteRes = await POSTQuote(createQuoteReq);
    const quoteData = await createQuoteRes.json();

    expect(createQuoteRes.status).toBe(200);
    const quoteId = quoteData.id;
    expect(quoteId).toBeDefined();

    // Verify quote in DB
    const dbQuote = testDb.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId) as any;
    expect(dbQuote).toBeDefined();
    expect(dbQuote.status).toBe(QUOTE_STATUS.EN_ATTENTE);

    // 2. Convert quote to invoice
    const convertReq = new Request('http://localhost/api/quotes/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId: quoteId }),
    });

    const convertRes = await POSTQuoteConvert(convertReq);
    const convertData = await convertRes.json();

    expect(convertRes.status).toBe(200);
    const invoiceId = convertData.invoiceId;
    expect(invoiceId).toBeDefined();

    // Verify quote status changed to 'CONVERTI'
    const dbQuoteInvoiced = testDb.prepare('SELECT status FROM quotes WHERE id = ?').get(quoteId) as any;
    expect(dbQuoteInvoiced.status).toBe(QUOTE_STATUS.CONVERTI);

    // Verify invoice created in DB
    const dbInvoice = testDb.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;
    expect(dbInvoice).toBeDefined();
    expect(dbInvoice.status).toBe(INVOICE_STATUS.UNPAID);
    expect(dbInvoice.total).toBe(12878);

    // 3. Record a partial payment
    const paymentPayload = {
      invoiceId: invoiceId,
      amount: 5000,
      paymentMethod: 'virement',
      date: '2026-06-08',
      reference: 'TXN-12345'
    };

    const paymentReq = new Request('http://localhost/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentPayload),
    });

    const paymentRes = await POSTPayment(paymentReq);
    const paymentData = await paymentRes.json();

    expect(paymentRes.status).toBe(200);
    const paymentId = paymentData.id;
    expect(paymentId).toBeDefined();

    // Assert that the invoice is status 'PARTIALLY_PAID' and remaining is computed
    const dbInvoicePaid = testDb.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;
    expect(dbInvoicePaid.status).toBe(INVOICE_STATUS.PARTIALLY_PAID);

    // Get total payments for invoice
    const totalPayments = testDb.prepare('SELECT SUM(amount) as total FROM payments WHERE invoiceId = ? AND deletedAt IS NULL').get(invoiceId) as any;
    expect(totalPayments.total).toBe(5000);
    const remaining = dbInvoicePaid.total - totalPayments.total;
    expect(remaining).toBe(7878);

    // 4. Soft delete the payment
    const deletePaymentReq = new Request(`http://localhost/api/payments/${paymentId}`, {
      method: 'DELETE',
    });

    // Deleting payments requires Admin session in standard rules. Let's authenticate as Admin.
    const adminSession = createAuthenticatedSession('admin');
    vi.mocked(getSession).mockResolvedValue(adminSession);

    const params = Promise.resolve({ id: paymentId });
    const deletePaymentRes = await DELETEPayment(deletePaymentReq, { params });
    const deletePaymentData = await deletePaymentRes.json();

    expect(deletePaymentRes.status).toBe(200);
    expect(deletePaymentData.success).toBe(true);

    // Verify payment is soft deleted in DB
    const dbDeletedPayment = testDb.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as any;
    expect(dbDeletedPayment.deletedAt).not.toBeNull();

    // Verify invoice status reverted to 'UNPAID'
    const dbInvoiceReverted = testDb.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;
    expect(dbInvoiceReverted.status).toBe(INVOICE_STATUS.UNPAID);
  });
});
