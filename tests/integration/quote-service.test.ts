import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QuoteService, QuoteServiceError } from '@/lib/services/QuoteService';
import db from '@/lib/db';
import crypto from 'crypto';
import { ROLES, QUOTE_STATUS } from '@/lib/constants';

describe('QuoteService Integration Tests', () => {
  const userId = crypto.randomUUID();
  const clientId = crypto.randomUUID();
  let quoteId: string;

  beforeEach(() => {
    // Setup necessary tables & data for a fresh run
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM quote_items').run();
    db.prepare('DELETE FROM quotes').run();
    db.prepare('DELETE FROM clients').run();
    db.prepare('DELETE FROM settings').run();

    // Seed settings
    db.prepare(`
      INSERT INTO settings (id, invoicePrefix, companyCode)
      VALUES (1, 'F-', 'CMP')
    `).run();

    // Seed client
    db.prepare(`
      INSERT INTO clients (id, name, email, created_by)
      VALUES (?, 'Test Client', 'test@example.com', ?)
    `).run(clientId, userId);

    quoteId = crypto.randomUUID();

    // Seed quote
    db.prepare(`
      INSERT INTO quotes (
        id, number, clientId, clientName, clientEmail, date,
        subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by
      ) VALUES (?, 'D-001', ?, 'Test Client', 'test@example.com', '2025-01-01',
        10000, 0, 10100, 1818, 960, 100, 12878, ?, ?)
    `).run(quoteId, clientId, QUOTE_STATUS.EN_ATTENTE, userId);

    // Seed quote items
    db.prepare(`
      INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
      VALUES (?, ?, 'Test Item', 1, 10000, 10000)
    `).run(crypto.randomUUID(), quoteId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully convert a valid quote to an invoice', () => {
    const response = QuoteService.convertToInvoice(quoteId, userId, ROLES.USER);

    expect(response).toHaveProperty('invoiceId');
    expect(response).toHaveProperty('invoiceNumber');
    expect(response.quoteId).toBe(quoteId);

    // Verify quote status is updated
    const updatedQuote = db.prepare('SELECT status FROM quotes WHERE id = ?').get(quoteId) as { status: string };
    expect(updatedQuote.status).toBe(QUOTE_STATUS.CONVERTI);

    // Verify invoice is created
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(response.invoiceId) as any;
    expect(invoice).toBeDefined();
    expect(invoice.quoteId).toBe(quoteId);
    expect(invoice.total).toBe(12878);

    // Verify invoice items are created
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(response.invoiceId) as any[];
    expect(items.length).toBe(1);
    expect(items[0].total).toBe(10000);
  });

  it('should fail transaction cleanly if inserting invoice item throws', () => {
    // We cannot mock db.prepare directly because of the proxy, and we are within a transaction.
    // Instead we will corrupt the items data in db so that the insert constraint fails,
    // or we mock crypto.randomUUID to return null which will fail the NOT NULL constraint,
    // or just mock the global db.prepare in a way that affects the underlying driver.

    // A simpler way: update the schema to strictly enforce something, or better yet,
    // use a mock on crypto.randomUUID to return an existing UUID to cause a PRIMARY KEY violation.

    // Let's create an existing invoice_item with a known ID, and mock randomUUID to return it
    const duplicateId = crypto.randomUUID();
    const dummyInvoiceId = crypto.randomUUID();

    // Create a dummy invoice first to satisfy foreign key constraint
    db.prepare(`
      INSERT INTO invoices (id, number, clientId, date, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status)
      VALUES (?, 'DUMMY-001', ?, '2025-01-01', 0, 0, 0, 0, 0, 0, 0, 'UNPAID')
    `).run(dummyInvoiceId, clientId);

    db.prepare(`
      INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(duplicateId, dummyInvoiceId, 'dummy', 1, 1, 1);

    const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      // Return the duplicate ID when creating the invoice item to trigger UNIQUE constraint failed
      return duplicateId;
    });

    // Expect the service to throw the SQLite UNIQUE constraint error
    expect(() => {
      QuoteService.convertToInvoice(quoteId, userId, ROLES.USER);
    }).toThrow(); // We just expect it to throw some db error

    // Verify the transaction was rolled back!

    // 1. Quote status should still be EN_ATTENTE
    const quote = db.prepare('SELECT status FROM quotes WHERE id = ?').get(quoteId) as { status: string };
    expect(quote.status).toBe(QUOTE_STATUS.EN_ATTENTE);

    // 2. Invoice should NOT exist
    const invoices = db.prepare('SELECT count(*) as count FROM invoices WHERE quoteId = ?').get(quoteId) as { count: number };
    expect(invoices.count).toBe(0);

    uuidSpy.mockRestore();
  });

  it('should fail to convert if quote is already converted', () => {
    // Update quote to CONVERTI
    db.prepare('UPDATE quotes SET status = ? WHERE id = ?').run(QUOTE_STATUS.CONVERTI, quoteId);

    expect(() => {
      QuoteService.convertToInvoice(quoteId, userId, ROLES.USER);
    }).toThrowError(new QuoteServiceError('Quote already converted', 400));
  });

  it('should fail to convert if quote is deleted', () => {
    // Soft delete quote
    db.prepare('UPDATE quotes SET deletedAt = ? WHERE id = ?').run(new Date().toISOString(), quoteId);

    expect(() => {
      QuoteService.convertToInvoice(quoteId, userId, ROLES.USER);
    }).toThrowError(new QuoteServiceError('Cannot convert a deleted quote', 400));
  });
});
