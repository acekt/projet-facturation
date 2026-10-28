import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CreditNoteService, CreditNoteServiceError } from '@/lib/services/CreditNoteService';
import { INVOICE_STATUS } from '@/lib/constants';
import { computeTotals } from '@/lib/math-logic';
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
            unitPrice: 1000,
          }
        ]
      }, adminUserId);
    }).toThrowError(new CreditNoteServiceError('Cannot create a credit note for an already cancelled invoice', 400));
  });

  it('should reject a credit note that exceeds cumulative invoice remaining total (D4)', () => {
    const adminUserId = 'admin-user';
    const clientId = 'client-cumul-1';
    const invoiceId = 'inv-cumul-1';

    testDb.prepare(`INSERT OR IGNORE INTO clients (id, name, email, created_by) VALUES (?, 'Client Cumul', 'cumul@test.com', ?)`).run(clientId, adminUserId);

    const rates = { tvaRate: 18, tpsRate: 9.5, cssRate: 1 };
    const computedInv = computeTotals([{ description: 'Service', quantity: 1, unitPrice: 10000 }], 0, rates);

    testDb.prepare(`
      INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by)
      VALUES (?, 'FAC-CUMUL-01', ?, 'Client Cumul', 'cumul@test.com', '2026-07-08', ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?)
    `).run(
      invoiceId, clientId,
      computedInv.subtotal, computedInv.discount, computedInv.taxBase,
      computedInv.tvaAmount, computedInv.tpsAmount, computedInv.cssAmount,
      computedInv.total, adminUserId
    );

    // Premier avoir partiel : 5 000 HT
    CreditNoteService.createCreditNote({
      invoiceId,
      reason: 'Premier avoir 50%',
      items: [{ description: 'Partiel 1', quantity: 1, unitPrice: 5000 }],
    }, adminUserId);

    // Deuxième avoir trop élevé : 6 000 HT (5000 + 6000 > 10000 HT) -> doit être refusé !
    expect(() => {
      CreditNoteService.createCreditNote({
        invoiceId,
        reason: 'Avoir excédentaire',
        items: [{ description: 'Excédent', quantity: 1, unitPrice: 6000 }],
      }, adminUserId);
    }).toThrowError(/dépasse le montant total/);
  });

  it('should support multiple partial credit notes and mark invoice CANCELLED once cumulative total is covered (D4)', async () => {
    const { updateInvoiceStatus } = await import('@/lib/api/invoice-logic');
    const adminUserId = 'admin-user';
    const clientId = 'client-cumul-2';
    const invoiceId = 'inv-cumul-2';

    testDb.prepare(`INSERT OR IGNORE INTO clients (id, name, email, created_by) VALUES (?, 'Client Cumul 2', 'cumul2@test.com', ?)`).run(clientId, adminUserId);

    const rates = { tvaRate: 18, tpsRate: 9.5, cssRate: 1 };
    const cn1Comp = computeTotals([{ description: 'Ligne 1', quantity: 1, unitPrice: 3000 }], 0, rates);
    const cn2Comp = computeTotals([{ description: 'Ligne 2', quantity: 1, unitPrice: 3000 }], 0, rates);
    const cn3Comp = computeTotals([{ description: 'Ligne 3', quantity: 1, unitPrice: 4000 }], 0, rates);
    const totalTtc = cn1Comp.total + cn2Comp.total + cn3Comp.total;

    testDb.prepare(`
      INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by)
      VALUES (?, 'FAC-CUMUL-02', ?, 'Client Cumul 2', 'cumul2@test.com', '2026-07-08', 10000, 0, 10000, 1800, 950, 100, ?, 'UNPAID', ?)
    `).run(invoiceId, clientId, totalTtc, adminUserId);

    // Avoir 1 : 3 000 HT
    const cn1 = CreditNoteService.createCreditNote({
      invoiceId,
      reason: 'Avoir partiel 1',
      items: [{ description: 'Ligne 1', quantity: 1, unitPrice: 3000 }],
    }, adminUserId);
    expect(cn1.id).toBeDefined();

    // Avoir 2 : 3 000 HT
    const cn2 = CreditNoteService.createCreditNote({
      invoiceId,
      reason: 'Avoir partiel 2',
      items: [{ description: 'Ligne 2', quantity: 1, unitPrice: 3000 }],
    }, adminUserId);
    expect(cn2.id).toBeDefined();

    // Facture toujours non annulée
    const invMid = testDb.prepare('SELECT status FROM invoices WHERE id = ?').get(invoiceId) as { status: string };
    expect(invMid.status).toBe('UNPAID');

    // Avoir 3 complémentaire : 4 000 HT (Total cumulé = 100% de la facture)
    const cn3 = CreditNoteService.createCreditNote({
      invoiceId,
      reason: 'Avoir final solde',
      items: [{ description: 'Ligne 3', quantity: 1, unitPrice: 4000 }],
    }, adminUserId);
    expect(cn3.id).toBeDefined();

    // Facture automatiquement passée à CANCELLED
    const invDone = testDb.prepare('SELECT status FROM invoices WHERE id = ?').get(invoiceId) as { status: string };
    expect(invDone.status).toBe(INVOICE_STATUS.CANCELLED);

    // Soft delete de cn3 : la facture doit être rouverte
    testDb.prepare("UPDATE credit_notes SET deletedAt = datetime('now') WHERE id = ?").run(cn3.id);
    const newStatus = updateInvoiceStatus(invoiceId);
    expect(newStatus).toBe('PARTIALLY_PAID');
    const invReopened = testDb.prepare('SELECT status FROM invoices WHERE id = ?').get(invoiceId) as { status: string };
    expect(invReopened.status).toBe('PARTIALLY_PAID');
  });
});
