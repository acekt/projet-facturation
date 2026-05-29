import { describe, it, expect, beforeEach } from 'vitest'
import db from '@/lib/db'
import { DELETE as deleteInvoice, GET as getInvoice, PUT as putInvoice } from '@/app/api/invoices/[id]/route'

describe('Quote & Invoice Lifecycle Integration', () => {
  beforeEach(() => {
    // Clear and reset state between tests. Since db is in-memory, we can drop/recreate or clean tables.
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM quote_items').run();
    db.prepare('DELETE FROM quotes').run();
    db.prepare('DELETE FROM clients').run();
    
    // Seed default client
    db.prepare("INSERT INTO clients (id, name, email, status) VALUES (?, ?, ?, ?)").run(
      'client-1',
      'Gabon Tech',
      'contact@gabontech.ga',
      'active'
    );
  });

  it('should implement the complete Quote -> Invoice -> Delete lifecycle correctly', async () => {
    // 1. Create a Quote in 'sent' state
    db.prepare(`
      INSERT INTO quotes (id, number, clientId, clientName, date, subtotal, taxBase, tvaAmount, cssAmount, total, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'quote-123',
      'DEV-001/2026',
      'client-1',
      'Gabon Tech',
      '2026-05-29',
      100000,
      101000,
      18180,
      1000,
      119180,
      'sent'
    );

    // Verify Quote created in 'sent'
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get('quote-123') as any;
    expect(quote).toBeDefined();
    expect(quote.status).toBe('sent');

    // 2. Convert Quote to Invoice (simulate conversion logic in SQLite)
    // Create Invoice referencing the Quote
    db.prepare(`
      INSERT INTO invoices (id, number, quoteId, clientId, clientName, date, subtotal, taxBase, tvaAmount, cssAmount, total, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'invoice-456',
      'FAC-001/2026',
      'quote-123',
      'client-1',
      'Gabon Tech',
      '2026-05-29',
      100000,
      101000,
      18180,
      1000,
      119180,
      'pending'
    );

    // Update Quote status to 'invoiced'
    db.prepare("UPDATE quotes SET status = 'invoiced' WHERE id = ?").run('quote-123');

    // Verify Quote status mutated to 'invoiced'
    const invoicedQuote = db.prepare('SELECT status FROM quotes WHERE id = ?').get('quote-123') as any;
    expect(invoicedQuote.status).toBe('invoiced');

    // 3. Verify Immutability (PUT on Invoice API handler should return 455/405 error)
    const putResponse = await putInvoice();
    expect(putResponse.status).toBe(405);
    const putData = await putResponse.json();
    expect(putData.error).toContain('immuable');

    // 4. Delete the Invoice via the Route Handler to test soft-delete and Quote restoration
    // Mock the params for Next.js route
    const deleteResponse = await deleteInvoice(new Request('http://localhost/api/invoices/invoice-456'), {
      params: { id: 'invoice-456' }
    });

    expect(deleteResponse.status).toBe(200);
    const deleteData = await deleteResponse.json();
    expect(deleteData.success).toBe(true);

    // Verify soft-deleted Invoice: status cancelled and deletedAt is not null
    const softDeletedInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get('invoice-456') as any;
    expect(softDeletedInvoice.status).toBe('cancelled');
    expect(softDeletedInvoice.deletedAt).not.toBeNull();

    // Verify that the Quote has been freed (status set back to 'sent')
    const freedQuote = db.prepare('SELECT status FROM quotes WHERE id = ?').get('quote-123') as any;
    expect(freedQuote.status).toBe('sent');
  });

  it('should return 404 when deleting a non-existent invoice', async () => {
    const response = await deleteInvoice(new Request('http://localhost/api/invoices/non-existent'), {
      params: { id: 'non-existent' }
    });
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Invoice not found');
  });
});
