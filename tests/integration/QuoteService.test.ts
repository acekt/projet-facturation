import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import db from '@/lib/db';
import { QuoteService, QuoteServiceError } from '@/lib/services/QuoteService';
import { ROLES, QUOTE_STATUS, INVOICE_STATUS } from '@/lib/constants';

describe('QuoteService Integration', () => {
  beforeEach(() => {
    // Clear out data
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM quote_items').run();
    db.prepare('DELETE FROM quotes').run();
    db.prepare('DELETE FROM clients').run();
  });

  afterEach(() => {
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM quote_items').run();
    db.prepare('DELETE FROM quotes').run();
    db.prepare('DELETE FROM clients').run();
  });

  it('should successfully convert a valid quote to an invoice', () => {
    // 1. Setup Data
    db.prepare(`
      INSERT INTO clients (id, name, email) VALUES ('client-1', 'Test Client', 'test@example.com')
    `).run();

    const quoteDate = new Date().toISOString().split('T')[0];
    const validUntil = new Date(Date.now() + 86400000).toISOString().split('T')[0]; // Tomorrow

    db.prepare(`
      INSERT INTO quotes (
        id, number, clientId, clientName, clientEmail, date, validUntil,
        subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by
      ) VALUES (
        'quote-1', 'DEV-2023-001', 'client-1', 'Test Client', 'test@example.com',
        ?, ?, 1000, 0, 1000, 180, 0, 10, 1190, ?, 'user-1'
      )
    `).run(quoteDate, validUntil, QUOTE_STATUS.EN_ATTENTE);

    db.prepare(`
      INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
      VALUES ('qi-1', 'quote-1', 'Item 1', 1, 1000, 1000)
    `).run();

    // Ensure settings exist (from init-db or previous tests, but let's be safe)
    db.prepare("INSERT OR IGNORE INTO settings (id, invoicePrefix, companyCode) VALUES (1, 'FA-', 'CMP')").run();

    // 2. Action
    const result = QuoteService.convertToInvoice('quote-1', 'user-1', ROLES.ADMIN);

    // 3. Assertion
    expect(result).toHaveProperty('invoiceId');
    expect(result.quoteId).toBe('quote-1');

    // Verify quote status changed
    const updatedQuote = db.prepare('SELECT status FROM quotes WHERE id = ?').get('quote-1') as { status: string };
    expect(updatedQuote.status).toBe(QUOTE_STATUS.CONVERTI);

    // Verify invoice was created
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(result.invoiceId) as any;
    expect(invoice).toBeDefined();
    expect(invoice.quoteId).toBe('quote-1');
    expect(invoice.total).toBe(1190);
    expect(invoice.status).toBe(INVOICE_STATUS.UNPAID);

    // Verify invoice items were created
    const invoiceItems = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(result.invoiceId) as any[];
    expect(invoiceItems.length).toBe(1);
    expect(invoiceItems[0].description).toBe('Item 1');
  });

  it('should rollback transaction if invoice insertion fails', () => {
    // 1. Setup Data
    db.prepare(`
      INSERT INTO clients (id, name, email) VALUES ('client-rollback', 'Rollback Client', 'roll@example.com')
    `).run();

    const quoteDate = new Date().toISOString().split('T')[0];
    const validUntil = new Date(Date.now() + 86400000).toISOString().split('T')[0]; // Tomorrow

    db.prepare(`
      INSERT INTO quotes (
        id, number, clientId, clientName, clientEmail, date, validUntil,
        subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by
      ) VALUES (
        'quote-bad', 'DEV-2023-BAD', 'client-rollback', 'Rollback Client', 'roll@example.com',
        ?, ?, 1000, 0, 1000, 180, 0, 10, 1190, ?, 'user-1'
      )
    `).run(quoteDate, validUntil, QUOTE_STATUS.EN_ATTENTE);

    db.prepare(`
      INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
      VALUES ('qi-bad', 'quote-bad', 'Item Bad', 1, 1000, 1000)
    `).run();

    db.prepare("INSERT OR IGNORE INTO settings (id, invoicePrefix, companyCode) VALUES (1, 'FA-', 'CMP')").run();

    // Alter the database state temporarily to make the transaction fail
    // We violate the constraint intentionally

    // We will drop the invoices table to force a constraint error during insert.
    // Wait, better-sqlite3 runs statements that are already prepared.
    // QuoteService prepares the statement BEFORE the transaction runs.
    // If we alter the table, the prepared statement might fail.
    // Another way to fail it is to insert an invalid quote item by tampering with the database.
    // However, the easiest way to fail a transaction is to introduce a constraint violation.
    // Let's create a trigger that throws an error on insert into invoice_items for this specific description.

    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS fail_insert_trigger
      BEFORE INSERT ON invoice_items
      FOR EACH ROW
      WHEN NEW.description = 'Item Bad'
      BEGIN
        SELECT RAISE(ABORT, 'Intentional failure for rollback test');
      END;
    `).run();

    // 2. Action
    expect(() => {
      QuoteService.convertToInvoice('quote-bad', 'user-1', ROLES.ADMIN);
    }).toThrow(/Intentional failure for rollback test/);

    // 3. Assertion: Rollback occurred
    const updatedQuote = db.prepare('SELECT status FROM quotes WHERE id = ?').get('quote-bad') as { status: string };
    expect(updatedQuote.status).toBe(QUOTE_STATUS.EN_ATTENTE); // Still EN_ATTENTE

    const invoices = db.prepare('SELECT * FROM invoices WHERE quoteId = ?').all('quote-bad');
    expect(invoices.length).toBe(0); // No invoice created

    // Cleanup trigger
    db.prepare(`DROP TRIGGER IF EXISTS fail_insert_trigger`).run();
  });
});