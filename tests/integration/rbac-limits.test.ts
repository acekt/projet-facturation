import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDatabase, seedTestData, cleanupTestDatabase, createAuthenticatedSession, getTestDatabase } from '../helpers/db';
import crypto from 'crypto';
import { getSession } from '@/lib/api/auth';
import { PATCH as PATCHSettings } from '@/app/api/settings/route';
import { GET as GETAuditLogs } from '@/app/api/audit-logs/route';
import { DELETE as DELETEQuote } from '@/app/api/quotes/[id]/route';
import { DELETE as DELETEInvoice } from '@/app/api/invoices/[id]/route';
import { DELETE as DELETEPayment } from '@/app/api/payments/[id]/route';

// Mock the global db module to redirect to test database (must be before API route imports)
vi.mock('@/lib/db', () => ({
  default: getTestDatabase(),
}));

// Mock the getSession function
vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

describe('Integration Test - RBAC Limits', () => {
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

  it('should restrict PATCH /api/settings to admin role only (User gets 403)', async () => {
    const session = createAuthenticatedSession('user');
    vi.mocked(getSession).mockResolvedValue(session);

    const request = new Request('http://localhost/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: 'New Corporate Name' }),
    });

    const response = await PATCHSettings(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Forbidden');
  });

  it('should restrict GET /api/audit-logs to admin role only (User gets 403)', async () => {
    const session = createAuthenticatedSession('user');
    vi.mocked(getSession).mockResolvedValue(session);

    const response = await GETAuditLogs();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Unauthorized');
  });

  it('should restrict DELETE /api/quotes/[id] to admin role only (User gets 403)', async () => {
    const session = createAuthenticatedSession('user');
    vi.mocked(getSession).mockResolvedValue(session);

    const quoteId = crypto.randomUUID();
    // Seed a quote first so we don't hit a 404
    testDb.prepare(`
      INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      quoteId,
      'DEV-999/GM/2026',
      'client-1',
      'Test Client',
      'client@test.com',
      '2026-01-01',
      '2026-01-15',
      10000,
      0,
      10100,
      1818,
      960,
      100,
      12878,
      'draft',
      new Date().toISOString()
    );

    const request = new Request(`http://localhost/api/quotes/${quoteId}`, {
      method: 'DELETE',
    });

    const params = await Promise.resolve({ id: quoteId });
    const response = await DELETEQuote(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden: Only Admin can delete quotes');
  });

  it('should restrict DELETE /api/invoices/[id] to admin role only (User gets 403)', async () => {
    const session = createAuthenticatedSession('user');
    vi.mocked(getSession).mockResolvedValue(session);

    const invoiceId = crypto.randomUUID();
    // Seed an invoice first
    testDb.prepare(`
      INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invoiceId,
      'FAC-999/GM/2026',
      'client-1',
      'Test Client',
      'client@test.com',
      '2026-01-01',
      '2026-01-15',
      10000,
      0,
      10100,
      1818,
      960,
      100,
      12878,
      'UNPAID',
      new Date().toISOString()
    );

    const request = new Request(`http://localhost/api/invoices/${invoiceId}`, {
      method: 'DELETE',
    });

    const params = await Promise.resolve({ id: invoiceId });
    const response = await DELETEInvoice(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden: Only Admin can delete invoices');
  });

  it('should restrict DELETE /api/payments/[id] to admin role only (User gets 403)', async () => {
    const session = createAuthenticatedSession('user');
    vi.mocked(getSession).mockResolvedValue(session);

    const invoiceId = crypto.randomUUID();
    // Seed an invoice
    testDb.prepare(`
      INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invoiceId,
      'FAC-888/GM/2026',
      'client-1',
      'Test Client',
      'client@test.com',
      '2026-01-01',
      '2026-01-15',
      10000,
      0,
      10100,
      1818,
      960,
      100,
      12878,
      'UNPAID',
      new Date().toISOString()
    );

    const paymentId = crypto.randomUUID();
    // Seed a payment
    testDb.prepare(`
      INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      paymentId,
      invoiceId,
      5000,
      'cash',
      '2026-01-02',
      'TXN-999',
      new Date().toISOString()
    );

    const request = new Request(`http://localhost/api/payments/${paymentId}`, {
      method: 'DELETE',
    });

    const params = await Promise.resolve({ id: paymentId });
    const response = await DELETEPayment(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden: Only Admin can delete payments');
  });
});
