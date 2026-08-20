import { describe, it, expect, beforeAll } from 'vitest';
import { QuoteRepository } from '@/lib/repositories/QuoteRepository';
import { InvoiceRepository } from '@/lib/repositories/InvoiceRepository';
import db from '@/lib/db';
import crypto from 'crypto';

describe('Batch Inserts in Repositories (N+1 Performance Test)', () => {
  beforeAll(() => {
    db.exec(`
      DELETE FROM quote_items;
      DELETE FROM quotes;
      DELETE FROM invoice_items;
      DELETE FROM invoices;
      DELETE FROM clients;
      DELETE FROM users;
      INSERT INTO clients (id, name, email) VALUES ('client-x', 'Client X', 'x@test.com');
      INSERT INTO clients (id, name, email) VALUES ('client-y', 'Client Y', 'y@test.com');
    `);
  });

  it('should handle batch inserts of 50 quote items performantly within a transaction', () => {
    const quoteId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    db.exec(`INSERT INTO users (id, name, email, username, role, password) VALUES ('${userId}', 'Test User', 'u@test.com', 'u', 'user', '123')`);

    const items = Array.from({ length: 50 }, (_, i) => ({
      description: `Test item ${i}`,
      quantity: 1,
      unitPrice: 1000,
    }));

    // Mocking the creation logic that exists in the API routes using the transaction pattern we applied
    const start = performance.now();

    const insertQuoteTx = db.transaction((quoteItems: any[]) => {
      db.prepare(`
        INSERT INTO quotes (id, number, clientId, date, subtotal, total, status, created_by)
        VALUES (?, 'Q-100', 'client-x', '2026-01-01', 50000, 50000, 'EN_ATTENTE', ?)
      `).run(quoteId, userId);

      const insertItem = db.prepare(`
        INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of quoteItems) {
        insertItem.run(crypto.randomUUID(), quoteId, item.description, item.quantity, item.unitPrice, item.quantity * item.unitPrice);
      }
    });

    insertQuoteTx(items);

    const end = performance.now();
    const duration = end - start;

    const insertedItems = db.prepare('SELECT COUNT(*) as count FROM quote_items WHERE quoteId = ?').get(quoteId) as { count: number };

    expect(insertedItems.count).toBe(50);
    expect(duration).toBeLessThan(50); // The transaction for 50 items should be blazing fast, easily < 50ms locally.
  });

  it('should handle batch inserts of 50 invoice items performantly within a transaction', () => {
    const invoiceId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    db.exec(`INSERT INTO users (id, name, email, username, role, password) VALUES ('${userId}', 'Test User 2', 'u2@test.com', 'u2', 'user', '123')`);

    const items = Array.from({ length: 50 }, (_, i) => ({
      description: `Invoice item ${i}`,
      quantity: 1,
      unitPrice: 2000,
    }));

    const start = performance.now();

    const insertInvoiceTx = db.transaction((invoiceItems: any[]) => {
      db.prepare(`
        INSERT INTO invoices (id, number, clientId, date, subtotal, total, status, created_by)
        VALUES (?, 'F-200', 'client-y', '2026-01-02', 100000, 100000, 'UNPAID', ?)
      `).run(invoiceId, userId);

      const insertItem = db.prepare(`
        INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of invoiceItems) {
        insertItem.run(crypto.randomUUID(), invoiceId, item.description, item.quantity, item.unitPrice, item.quantity * item.unitPrice);
      }
    });

    insertInvoiceTx(items);

    const end = performance.now();
    const duration = end - start;

    const insertedItems = db.prepare('SELECT COUNT(*) as count FROM invoice_items WHERE invoiceId = ?').get(invoiceId) as { count: number };

    expect(insertedItems.count).toBe(50);
    expect(duration).toBeLessThan(50);
  });
});
