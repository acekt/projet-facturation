import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDatabase, seedTestData, cleanupTestDatabase, createAuthenticatedSession, getTestDatabase } from '../helpers/db';
import crypto from 'crypto';
import type { ErrorResponse } from '@/lib/types/api';

// Mock the global db module to redirect to test database (must be before API route imports)
vi.mock('@/lib/db', () => ({
  default: getTestDatabase(),
}));

// Mock the getSession function
vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

import { GET as GETPayments, POST as POSTPayment } from '@/app/api/payments/route';
import { DELETE as DELETEPayment } from '@/app/api/payments/[id]/route';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';

describe('API RBAC Tests - Payments Module', () => {
  let testDb: ReturnType<typeof createTestDatabase>;

  beforeEach(() => {
    testDb = createTestDatabase();
    seedTestData(testDb);
    vi.clearAllMocks();
    invoiceCounter = 0;
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

  let invoiceCounter = 0;
  function getUniqueInvoiceNumber(): string {
    invoiceCounter++;
    return `FAC-${String(invoiceCounter + 100).padStart(3, '0')}/GM/2026`;
  }

  describe('GET /api/payments - List Payments', () => {
    it('should allow User to list payments', async () => {
      const session = createAuthenticatedSession('user');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const request = new Request('http://localhost/api/payments', {
        method: 'GET',
      });

      const response = await GETPayments(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should allow Admin to list payments', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const request = new Request('http://localhost/api/payments', {
        method: 'GET',
      });

      const response = await GETPayments(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should allow unauthenticated users to list payments', async () => {
      vi.mocked(getSession).mockResolvedValue(null);
      
      const request = new Request('http://localhost/api/payments', {
        method: 'GET',
      });

      const response = await GETPayments(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('POST /api/payments - Create Payment', () => {
    it('should allow User to create a payment', async () => {
      const session = createAuthenticatedSession('user');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const invoiceId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId,
        getUniqueInvoiceNumber(),
        getTestClientId(),
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

      const request = new Request('http://localhost/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoiceId,
          amount: 5000,
          paymentMethod: 'cash',
          date: '2026-01-10',
          reference: 'REF-001',
        }),
      });

      const response = await POSTPayment(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBeDefined();
      expect(data.newStatus).toBe('PARTIALLY_PAID');
    });

    it('should deny Admin from creating payments (only Users can create)', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const invoiceId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId,
        getUniqueInvoiceNumber(),
        getTestClientId(),
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

      const request = new Request('http://localhost/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoiceId,
          amount: 5000,
          paymentMethod: 'cash',
          date: '2026-01-10',
          reference: 'REF-001',
        }),
      });

      const response = await POSTPayment(request);
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized: Only Users can record payments');
    });

    it('should deny unauthenticated users from creating payments', async () => {
      vi.mocked(getSession).mockResolvedValue(null);
      
      const invoiceId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId,
        getUniqueInvoiceNumber(),
        getTestClientId(),
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

      const request = new Request('http://localhost/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoiceId,
          amount: 5000,
          paymentMethod: 'cash',
          date: '2026-01-10',
          reference: 'REF-001',
        }),
      });

      const response = await POSTPayment(request);
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized: Authentication required');
    });
  });

  describe('DELETE /api/payments/[id] - Delete Payment (Soft Delete)', () => {
    it('should allow Admin to soft-delete a payment', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const invoiceId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId,
        getUniqueInvoiceNumber(),
        getTestClientId(),
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
        'PAID',
        new Date().toISOString()
      );

      const paymentId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        paymentId,
        invoiceId,
        12878,
        'cash',
        '2026-01-10',
        'REF-001',
        new Date().toISOString()
      );

      const request = new Request(`http://localhost/api/payments/${paymentId}`, {
        method: 'DELETE',
      });

      const params = await Promise.resolve({ id: paymentId });
      const response = await DELETEPayment(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.newStatus).toBe('UNPAID');
    });

    it('should deny User from soft-deleting payments (only Admin can delete)', async () => {
      const session = createAuthenticatedSession('user');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const invoiceId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId,
        getUniqueInvoiceNumber(),
        getTestClientId(),
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
        'PAID',
        new Date().toISOString()
      );

      const paymentId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        paymentId,
        invoiceId,
        12878,
        'cash',
        '2026-01-10',
        'REF-001',
        new Date().toISOString()
      );

      const request = new Request(`http://localhost/api/payments/${paymentId}`, {
        method: 'DELETE',
      });

      const params = await Promise.resolve({ id: paymentId });
      const response = await DELETEPayment(request, { params });
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden: Only Admin can delete payments');
    });

    it('should deny unauthenticated users from soft-deleting payments', async () => {
      vi.mocked(getSession).mockResolvedValue(null);
      
      const invoiceId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId,
        getUniqueInvoiceNumber(),
        getTestClientId(),
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
        'PAID',
        new Date().toISOString()
      );

      const paymentId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        paymentId,
        invoiceId,
        12878,
        'cash',
        '2026-01-10',
        'REF-001',
        new Date().toISOString()
      );

      const request = new Request(`http://localhost/api/payments/${paymentId}`, {
        method: 'DELETE',
      });

      const params = await Promise.resolve({ id: paymentId });
      const response = await DELETEPayment(request, { params });
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden: Only Admin can delete payments');
    });

    it('should return 404 when attempting to delete a non-existent payment', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const paymentId = 'non-existent-payment-id';
      
      const request = new Request(`http://localhost/api/payments/${paymentId}`, {
        method: 'DELETE',
      });

      const params = await Promise.resolve({ id: paymentId });
      const response = await DELETEPayment(request, { params });
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Payment not found');
    });

    it('should return 404 when attempting to delete an already soft-deleted payment', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const invoiceId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId,
        getUniqueInvoiceNumber(),
        getTestClientId(),
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
        'PAID',
        new Date().toISOString()
      );

      const paymentId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, deletedAt, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        paymentId,
        invoiceId,
        12878,
        'cash',
        '2026-01-10',
        'REF-001',
        new Date().toISOString(),
        new Date().toISOString()
      );

      const request = new Request(`http://localhost/api/payments/${paymentId}`, {
        method: 'DELETE',
      });

      const params = await Promise.resolve({ id: paymentId });
      const response = await DELETEPayment(request, { params });
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Payment not found');
    });

    it('should recalculate invoice status after soft-delete of payment', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const invoiceId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId,
        getUniqueInvoiceNumber(),
        getTestClientId(),
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
        'PAID',
        new Date().toISOString()
      );

      const paymentId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        paymentId,
        invoiceId,
        12878,
        'cash',
        '2026-01-10',
        'REF-001',
        new Date().toISOString()
      );

      const request = new Request(`http://localhost/api/payments/${paymentId}`, {
        method: 'DELETE',
      });

      const params = await Promise.resolve({ id: paymentId });
      const response = await DELETEPayment(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.newStatus).toBe('UNPAID');

      const invoice = testDb.prepare('SELECT status FROM invoices WHERE id = ?').get(invoiceId) as { status: string };
      expect(invoice.status).toBe('UNPAID');
    });

    it('should recalculate invoice to PARTIALLY_PAID when deleting one of multiple payments', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const invoiceId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId,
        getUniqueInvoiceNumber(),
        getTestClientId(),
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
        'PAID',
        new Date().toISOString()
      );

      const paymentId1 = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        paymentId1,
        invoiceId,
        6000,
        'cash',
        '2026-01-10',
        'REF-001',
        new Date().toISOString()
      );

      const paymentId2 = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        paymentId2,
        invoiceId,
        6878,
        'bank_transfer',
        '2026-01-11',
        'REF-002',
        new Date().toISOString()
      );

      const request = new Request(`http://localhost/api/payments/${paymentId1}`, {
        method: 'DELETE',
      });

      const params = await Promise.resolve({ id: paymentId1 });
      const response = await DELETEPayment(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.newStatus).toBe('PARTIALLY_PAID');

      const invoice = testDb.prepare('SELECT status FROM invoices WHERE id = ?').get(invoiceId) as { status: string };
      expect(invoice.status).toBe('PARTIALLY_PAID');
    });
  });
});
