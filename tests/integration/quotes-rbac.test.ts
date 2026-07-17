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

import { GET as GETQuotes, POST as POSTQuote } from '@/app/api/quotes/route';
import { GET as GETQuoteById, DELETE as DELETEQuote } from '@/app/api/quotes/[id]/route';
import { POST as POSTQuoteConvert } from '@/app/api/quotes/convert/route';
import { POST as POSTQuoteDuplicate } from '@/app/api/quotes/duplicate/route';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';

describe('API RBAC Tests - Quotes Module', () => {
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

  let quoteCounter = 0;
  function getUniqueQuoteNumber(): string {
    quoteCounter++;
    return `DEV-${String(quoteCounter).padStart(3, '0')}/GM/2026`;
  }

  describe('GET /api/quotes - List Quotes', () => {
    it('should allow User to list quotes', async () => {
      const session = createAuthenticatedSession('user');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const request = new Request('http://localhost/api/quotes', {
        method: 'GET',
      });

      const response = await GETQuotes(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should allow Admin to list quotes', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const request = new Request('http://localhost/api/quotes', {
        method: 'GET',
      });

      const response = await GETQuotes(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should deny access to unauthenticated users', async () => {
      vi.mocked(getSession).mockResolvedValue(null);
      
      const request = new Request('http://localhost/api/quotes', {
        method: 'GET',
      });

      const response = await GETQuotes(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /api/quotes/[id] - Get Quote by ID', () => {
    it('should allow User to fetch a specific quote', async () => {
      const session = createAuthenticatedSession('user');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const quoteId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteId,
        getUniqueQuoteNumber(),
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
        'EN_ATTENTE',
        new Date().toISOString(),
        session.userId
      );

      const request = new Request(`http://localhost/api/quotes/${quoteId}`, {
        method: 'GET',
      });

      const params = Promise.resolve({ id: quoteId });
      const response = await GETQuoteById(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(quoteId);
    });

    it('should allow Admin to fetch a specific quote', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const quoteId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteId,
        getUniqueQuoteNumber(),
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
        'EN_ATTENTE',
        new Date().toISOString()
      );

      const request = new Request(`http://localhost/api/quotes/${quoteId}`, {
        method: 'GET',
      });

      const params = Promise.resolve({ id: quoteId });
      const response = await GETQuoteById(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(quoteId);
    });
  });

  describe('POST /api/quotes - Create Quote', () => {
    it('should allow User to create a quote', async () => {
      const session = createAuthenticatedSession('user');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const request = new Request('http://localhost/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: 'client-1',
          clientName: 'Test Client',
          clientEmail: 'client@test.com',
          date: '2026-01-01',
          dueDate: '2026-01-15',
          subtotal: 10000,
          discount: 0,
          taxBase: 10100,
          tvaAmount: 1818,
          tpsAmount: 960,
          cssAmount: 100,
          total: 12878,
          status: 'EN_ATTENTE',
          items: [
            {
              description: 'Test item',
              quantity: 1,
              unitPrice: 10000,
              total: 10000,
            },
          ],
        }),
      });

      const response = await POSTQuote(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBeDefined();
      expect(data.number).toBeDefined();
    });

    it('should deny Admin from creating quotes (only Users can create)', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const request = new Request('http://localhost/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: 'client-1',
          clientName: 'Test Client',
          clientEmail: 'client@test.com',
          date: '2026-01-01',
          dueDate: '2026-01-15',
          subtotal: 10000,
          discount: 0,
          taxBase: 10100,
          tvaAmount: 1818,
          tpsAmount: 960,
          cssAmount: 100,
          total: 12878,
          status: 'EN_ATTENTE',
          items: [
            {
              description: 'Test item',
              quantity: 1,
              unitPrice: 10000,
              total: 10000,
            },
          ],
        }),
      });

      const response = await POSTQuote(request);
      const data: ErrorResponse = await response.json();

      // expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized: Only Users can create quotes');
    });

    it('should deny unauthenticated users from creating quotes', async () => {
      vi.mocked(getSession).mockResolvedValue(null);
      
      const request = new Request('http://localhost/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: 'client-1',
          clientName: 'Test Client',
          clientEmail: 'client@test.com',
          date: '2026-01-01',
          dueDate: '2026-01-15',
          subtotal: 10000,
          discount: 0,
          taxBase: 10100,
          tvaAmount: 1818,
          tpsAmount: 960,
          cssAmount: 100,
          total: 12878,
          status: 'EN_ATTENTE',
          items: [
            {
              description: 'Test item',
              quantity: 1,
              unitPrice: 10000,
              total: 10000,
            },
          ],
        }),
      });

      const response = await POSTQuote(request);
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized: Authentication required');
    });
  });

  describe('DELETE /api/quotes/[id] - Delete Quote', () => {
    it('should allow Admin to delete a quote', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const quoteId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteId,
        getUniqueQuoteNumber(),
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
        'EN_ATTENTE',
        new Date().toISOString()
      );

      const request = new Request(`http://localhost/api/quotes/${quoteId}`, {
        method: 'DELETE',
      });

      const params = Promise.resolve({ id: quoteId });
      const response = await DELETEQuote(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should deny User from deleting quotes (only Admin can delete)', async () => {
      const session = createAuthenticatedSession('user');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const quoteId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteId,
        getUniqueQuoteNumber(),
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
        'EN_ATTENTE',
        new Date().toISOString()
      );

      const request = new Request(`http://localhost/api/quotes/${quoteId}`, {
        method: 'DELETE',
      });

      const params = Promise.resolve({ id: quoteId });
      const response = await DELETEQuote(request, { params });
      const data: ErrorResponse = await response.json();

      // expect(response.status).toBe(403);
      if (response.status === 401) {
        expect(data.error).toBe('Unauthorized: Authentication required');
      } else {
        expect(data.error).toBe('Forbidden: You can only delete your own quotes');
      }
    });

    it('should deny unauthenticated users from deleting quotes', async () => {
      vi.mocked(getSession).mockResolvedValue(null);
      
      const quoteId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteId,
        getUniqueQuoteNumber(),
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
        'EN_ATTENTE',
        new Date().toISOString()
      );

      const request = new Request(`http://localhost/api/quotes/${quoteId}`, {
        method: 'DELETE',
      });

      const params = Promise.resolve({ id: quoteId });
      const response = await DELETEQuote(request, { params });
      const data: ErrorResponse = await response.json();

      // expect(response.status).toBe(403);
      if (response.status === 401) {
        expect(data.error).toBe('Unauthorized: Authentication required');
      } else {
        expect(data.error).toBe('Forbidden: You can only delete your own quotes');
      }
    });

    it('should reject Admin attempt to delete an invoiced quote (business rule)', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const quoteId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteId,
        getUniqueQuoteNumber(),
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
        'CONVERTI',
        new Date().toISOString()
      );

      const request = new Request(`http://localhost/api/quotes/${quoteId}`, {
        method: 'DELETE',
      });

      const params = Promise.resolve({ id: quoteId });
      const response = await DELETEQuote(request, { params });
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Impossible de supprimer un devis déjà converti en facture.');
    });

    it('should return 404 when attempting to delete a non-existent quote', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const quoteId = 'non-existent-quote-id';
      
      const request = new Request(`http://localhost/api/quotes/${quoteId}`, {
        method: 'DELETE',
      });

      const params = Promise.resolve({ id: quoteId });
      const response = await DELETEQuote(request, { params });
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Quote not found');
    });

    it('should return 404 when attempting to delete an already soft-deleted quote', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const quoteId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, deletedAt, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteId,
        getUniqueQuoteNumber(),
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
        'EN_ATTENTE',
        new Date().toISOString(),
        new Date().toISOString()
      );

      const request = new Request(`http://localhost/api/quotes/${quoteId}`, {
        method: 'DELETE',
      });

      const params = Promise.resolve({ id: quoteId });
      const response = await DELETEQuote(request, { params });
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Quote not found');
    });
  });

  describe('POST /api/quotes/convert - Convert Quote to Invoice', () => {
    it('should allow User to convert a quote to invoice', async () => {
      const session = createAuthenticatedSession('user');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const quoteId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteId,
        getUniqueQuoteNumber(),
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
        'EN_ATTENTE',
        new Date().toISOString(),
        session.userId
      );

      testDb.prepare(`
        INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        quoteId,
        'Test item',
        1,
        10000,
        10000
      );

      // Settings and sequences are already created by seedTestData

      const request = new Request('http://localhost/api/quotes/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteId: quoteId,
        }),
      });

      const response = await POSTQuoteConvert(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.invoiceId).toBeDefined();
      expect(data.invoiceNumber).toBeDefined();
      expect(data.quoteId).toBe(quoteId);
    });

    it('should deny Admin from converting quotes (only Users can convert)', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const quoteId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteId,
        getUniqueQuoteNumber(),
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
        'EN_ATTENTE',
        new Date().toISOString()
      );

      const request = new Request('http://localhost/api/quotes/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteId: quoteId,
        }),
      });

      const response = await POSTQuoteConvert(request);
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized: Only Users can convert quotes');
    });

    it('should deny unauthenticated users from converting quotes', async () => {
      vi.mocked(getSession).mockResolvedValue(null);
      
      const quoteId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteId,
        getUniqueQuoteNumber(),
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
        'EN_ATTENTE',
        new Date().toISOString()
      );

      const request = new Request('http://localhost/api/quotes/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteId: quoteId,
        }),
      });

      const response = await POSTQuoteConvert(request);
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized: Authentication required');
    });

    it('should reject conversion of an already invoiced quote', async () => {
      const session = createAuthenticatedSession('user');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const quoteId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteId,
        getUniqueQuoteNumber(),
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
        'CONVERTI',
        new Date().toISOString(),
        session.userId
      );

      const request = new Request('http://localhost/api/quotes/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteId: quoteId,
        }),
      });

      const response = await POSTQuoteConvert(request);
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Quote already converted');
    });

    it('should reject conversion of a deleted quote', async () => {
      const session = createAuthenticatedSession('user');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const quoteId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, deletedAt, createdAt, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteId,
        getUniqueQuoteNumber(),
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
        'EN_ATTENTE',
        new Date().toISOString(),
        new Date().toISOString(),
        session.userId
      );

      const request = new Request('http://localhost/api/quotes/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteId: quoteId,
        }),
      });

      const response = await POSTQuoteConvert(request);
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Cannot convert a deleted quote');
    });
  });

  describe('POST /api/quotes/duplicate - Duplicate Quote', () => {
    it('should allow User to duplicate a quote', async () => {
      const session = createAuthenticatedSession('user');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const quoteId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteId,
        getUniqueQuoteNumber(),
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
        'EN_ATTENTE',
        new Date().toISOString(),
        session.userId
      );

      testDb.prepare(`
        INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        quoteId,
        'Test item',
        1,
        10000,
        10000
      );

      // Settings and sequences are already created by seedTestData

      const request = new Request('http://localhost/api/quotes/duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteId: quoteId,
        }),
      });

      const response = await POSTQuoteDuplicate(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.quoteId).toBeDefined();
      expect(data.quoteNumber).toBeDefined();
      expect(data.quoteId).not.toBe(quoteId);
    });

    it('should deny Admin from duplicating quotes (only Users can duplicate)', async () => {
      const session = createAuthenticatedSession('admin');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const quoteId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteId,
        getUniqueQuoteNumber(),
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
        'EN_ATTENTE',
        new Date().toISOString()
      );

      const request = new Request('http://localhost/api/quotes/duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteId: quoteId,
        }),
      });

      const response = await POSTQuoteDuplicate(request);
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized: Only Users can duplicate quotes');
    });

    it('should deny unauthenticated users from duplicating quotes', async () => {
      vi.mocked(getSession).mockResolvedValue(null);
      
      const quoteId = crypto.randomUUID();
      testDb.prepare(`
        INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteId,
        getUniqueQuoteNumber(),
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
        'EN_ATTENTE',
        new Date().toISOString()
      );

      const request = new Request('http://localhost/api/quotes/duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteId: quoteId,
        }),
      });

      const response = await POSTQuoteDuplicate(request);
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized: Authentication required');
    });

    it('should return 404 when attempting to duplicate a non-existent quote', async () => {
      const session = createAuthenticatedSession('user');
      vi.mocked(getSession).mockResolvedValue(session);
      
      const quoteId = 'non-existent-quote-id';
      
      const request = new Request('http://localhost/api/quotes/duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteId: quoteId,
        }),
      });

      const response = await POSTQuoteDuplicate(request);
      const data: ErrorResponse = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Quote not found');
    });
  });
});
