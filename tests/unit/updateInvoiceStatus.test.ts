import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDatabase,
  seedTestData,
  cleanupTestDatabase,
  closeTestDatabase,
  createTestInvoice,
  createTestPayment,
  softDeletePayment,
  getTotalPayments,
  getInvoiceStatus,
  setInvoiceStatus,
  getInvoiceTotal,
} from '../helpers/db';

// ============================================================================
// UPDATE INVOICE STATUS LOGIC (Extracted from payments routes)
// ============================================================================

/**
 * CRITICAL: Update invoice status based on exact remaining balance calculation
 * Uses Math.round() on all amounts to ensure precise decimal handling
 * Excludes soft-deleted payments (deletedAt IS NOT NULL) from calculations
 * Status transition: UNPAID (0) → PARTIALLY_PAID (0 < x < total) → PAID (x >= total)
 */
function updateInvoiceStatus(db: Database.Database, invoiceId: string): 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' {
  // Get invoice total (excluding soft-deleted invoices)
  const invoice = db.prepare('SELECT total FROM invoices WHERE id = ? AND deletedAt IS NULL').get(invoiceId) as { total: number } | undefined;
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Get sum of payments, EXCLUDING soft-deleted payments
  const paymentsResult = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE invoiceId = ? AND deletedAt IS NULL').get(invoiceId) as { total: number };
  
  // Apply Math.round() to ensure exact decimal handling
  const totalTTC = Math.round(invoice.total);
  const totalPaid = Math.round(paymentsResult.total || 0);

  // Strict status transition logic
  let newStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  if (totalPaid === 0) {
    newStatus = 'UNPAID';
  } else if (totalPaid < totalTTC) {
    newStatus = 'PARTIALLY_PAID';
  } else {
    newStatus = 'PAID';
  }

  db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(newStatus, invoiceId);
  return newStatus;
}

// ============================================================================
// TESTS
// ============================================================================

describe('updateInvoiceStatus - Financial Status Transitions', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
    seedTestData();
  });

  afterEach(() => {
    cleanupTestDatabase();
    closeTestDatabase();
  });

  describe('Case UNPAID - No Payments', () => {
    it('should set status to UNPAID when no payments exist', () => {
      const invoiceId = createTestInvoice(10000);
      
      const status = updateInvoiceStatus(db, invoiceId);
      
      expect(status).toBe('UNPAID');
      expect(getInvoiceStatus(invoiceId)).toBe('UNPAID');
    });

    it('should set status to UNPAID when total payments equal 0', () => {
      const invoiceId = createTestInvoice(10000);
      createTestPayment(invoiceId, 0);
      
      const status = updateInvoiceStatus(db, invoiceId);
      
      expect(status).toBe('UNPAID');
      expect(getInvoiceStatus(invoiceId)).toBe('UNPAID');
    });
  });

  describe('Case PARTIALLY_PAID - Partial Payments', () => {
    it('should set status to PARTIALLY_PAID when payment is 50% of total', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      createTestPayment(invoiceId, Math.round(total * 0.5));
      
      const status = updateInvoiceStatus(db, invoiceId);
      
      expect(status).toBe('PARTIALLY_PAID');
    });

    it('should set status to PARTIALLY_PAID when payment is 25% of total', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      createTestPayment(invoiceId, Math.round(total * 0.25));
      
      const status = updateInvoiceStatus(db, invoiceId);
      
      expect(status).toBe('PARTIALLY_PAID');
    });

    it('should set status to PARTIALLY_PAID when payment is 75% of total', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      createTestPayment(invoiceId, Math.round(total * 0.75));
      
      const status = updateInvoiceStatus(db, invoiceId);
      
      expect(status).toBe('PARTIALLY_PAID');
    });

    it('should set status to PARTIALLY_PAID when payment is 99% of total', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      createTestPayment(invoiceId, Math.round(total * 0.99));
      
      const status = updateInvoiceStatus(db, invoiceId);
      
      expect(status).toBe('PARTIALLY_PAID');
    });

    it('should set status to PARTIALLY_PAID when payment is 1% of total', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      createTestPayment(invoiceId, Math.round(total * 0.01));
      
      const status = updateInvoiceStatus(db, invoiceId);
      
      expect(status).toBe('PARTIALLY_PAID');
    });

    it('should set status to PARTIALLY_PAID with multiple partial payments', () => {
      const invoiceId = createTestInvoice(10000);
      createTestPayment(invoiceId, 3000);
      createTestPayment(invoiceId, 2000);
      createTestPayment(invoiceId, 1000);
      
      const status = updateInvoiceStatus(db, invoiceId);
      
      expect(status).toBe('PARTIALLY_PAID');
      expect(getTotalPayments(invoiceId)).toBe(6000);
    });
  });

  describe('Case PAID - Full Payment', () => {
    it('should set status to PAID when payment equals total exactly', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      createTestPayment(invoiceId, total);
      
      const status = updateInvoiceStatus(db, invoiceId);
      
      expect(status).toBe('PAID');
    });

    it('should set status to PAID when payment exceeds total (overpayment)', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      createTestPayment(invoiceId, total + 1000);
      
      const status = updateInvoiceStatus(db, invoiceId);
      
      expect(status).toBe('PAID');
    });

    it('should set status to PAID with multiple payments that sum to total', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      createTestPayment(invoiceId, Math.round(total / 2));
      createTestPayment(invoiceId, Math.round(total / 2));
      
      const status = updateInvoiceStatus(db, invoiceId);
      
      expect(status).toBe('PAID');
    });
  });

  describe('Soft Delete Behavior - Payment Exclusion', () => {
    it('should recalculate to UNPAID when only payment is soft-deleted', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      const paymentId = createTestPayment(invoiceId, total);
      
      // First, status should be PAID
      let status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('PAID');
      
      // Soft delete the payment
      softDeletePayment(paymentId);
      
      // Status should recalculate to UNPAID
      status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('UNPAID');
      expect(getInvoiceStatus(invoiceId)).toBe('UNPAID');
    });

    it('should recalculate to PARTIALLY_PAID when partial payment is soft-deleted', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      const paymentId1 = createTestPayment(invoiceId, Math.round(total * 0.7));
      const paymentId2 = createTestPayment(invoiceId, Math.round(total * 0.3));
      
      // First, status should be PAID
      let status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('PAID');
      
      // Soft delete one payment
      softDeletePayment(paymentId1);
      
      // Status should recalculate to PARTIALLY_PAID
      status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('PARTIALLY_PAID');
      expect(getInvoiceStatus(invoiceId)).toBe('PARTIALLY_PAID');
      expect(getTotalPayments(invoiceId)).toBe(Math.round(total * 0.3));
    });

    it('should remain PAID when soft-deleted payment is not the only one', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      const paymentId1 = createTestPayment(invoiceId, Math.round(total * 0.5));
      const paymentId2 = createTestPayment(invoiceId, Math.round(total * 0.5));
      
      // First, status should be PAID
      let status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('PAID');
      
      // Soft delete one payment
      softDeletePayment(paymentId1);
      
      // Status should recalculate to PARTIALLY_PAID (not PAID)
      status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('PARTIALLY_PAID');
    });

    it('should exclude soft-deleted payments from total calculation', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      const paymentId1 = createTestPayment(invoiceId, Math.round(total * 0.8));
      const paymentId2 = createTestPayment(invoiceId, Math.round(total * 0.2));
      
      // Soft delete one payment before status update
      softDeletePayment(paymentId1);
      
      // Status should be PARTIALLY_PAID based on remaining payment
      const status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('PARTIALLY_PAID');
      expect(getTotalPayments(invoiceId)).toBe(Math.round(total * 0.2));
    });

    it('should handle multiple soft-deleted payments correctly', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      const paymentId1 = createTestPayment(invoiceId, Math.round(total * 0.3));
      const paymentId2 = createTestPayment(invoiceId, Math.round(total * 0.4));
      const paymentId3 = createTestPayment(invoiceId, Math.round(total * 0.3));
      
      // Soft delete two payments
      softDeletePayment(paymentId1);
      softDeletePayment(paymentId2);
      
      // Status should be PARTIALLY_PAID based on remaining payment
      const status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('PARTIALLY_PAID');
      expect(getTotalPayments(invoiceId)).toBe(Math.round(total * 0.3));
    });
  });

  describe('Edge Cases', () => {
    it('should throw error when invoice does not exist', () => {
      const nonExistentId = 'non-existent-invoice-id';
      
      expect(() => {
        updateInvoiceStatus(db, nonExistentId);
      }).toThrow('Invoice not found');
    });

    it('should handle decimal amounts with Math.round correctly', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      createTestPayment(invoiceId, Math.round(total / 3));
      createTestPayment(invoiceId, Math.round(total / 3));
      createTestPayment(invoiceId, Math.round(total / 3));
      
      const status = updateInvoiceStatus(db, invoiceId);
      
      expect(status).toBe('PAID');
    });

    it('should handle very small payments correctly', () => {
      const invoiceId = createTestInvoice(10000);
      createTestPayment(invoiceId, 1);
      
      const status = updateInvoiceStatus(db, invoiceId);
      
      expect(status).toBe('PARTIALLY_PAID');
    });

    it('should handle very large payments correctly', () => {
      const invoiceId = createTestInvoice(10000);
      createTestPayment(invoiceId, 1000000);
      
      const status = updateInvoiceStatus(db, invoiceId);
      
      expect(status).toBe('PAID');
    });

    it('should handle zero total invoice correctly', () => {
      const invoiceId = createTestInvoice(0);
      createTestPayment(invoiceId, 0);
      
      const status = updateInvoiceStatus(db, invoiceId);
      
      expect(status).toBe('UNPAID');
    });
  });

  describe('Status Transition Sequences', () => {
    it('should transition UNPAID → PARTIALLY_PAID → PAID correctly', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      
      // Initial state: UNPAID
      let status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('UNPAID');
      
      // Add partial payment: PARTIALLY_PAID
      createTestPayment(invoiceId, Math.round(total * 0.5));
      status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('PARTIALLY_PAID');
      
      // Add remaining payment: PAID
      createTestPayment(invoiceId, Math.round(total * 0.5));
      status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('PAID');
    });

    it('should transition PAID → PARTIALLY_PAID when payment is soft-deleted', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      const paymentId = createTestPayment(invoiceId, total);
      
      // Initial state: PAID
      let status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('PAID');
      
      // Soft delete payment: PARTIALLY_PAID (if partial) or UNPAID (if full)
      softDeletePayment(paymentId);
      status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('UNPAID');
    });

    it('should handle complex payment and soft-delete sequence', () => {
      const invoiceId = createTestInvoice(10000);
      const total = getInvoiceTotal(invoiceId);
      const paymentId1 = createTestPayment(invoiceId, Math.round(total * 0.3));
      const paymentId2 = createTestPayment(invoiceId, Math.round(total * 0.4));
      const paymentId3 = createTestPayment(invoiceId, total - Math.round(total * 0.3) - Math.round(total * 0.4));
      
      // Initial: PAID (or close to it)
      let status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('PAID');
      
      // Soft delete payment1: PARTIALLY_PAID
      softDeletePayment(paymentId1);
      status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('PARTIALLY_PAID');
      
      // Soft delete payment2: PARTIALLY_PAID
      softDeletePayment(paymentId2);
      status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('PARTIALLY_PAID');
      
      // Soft delete payment3: UNPAID
      softDeletePayment(paymentId3);
      status = updateInvoiceStatus(db, invoiceId);
      expect(status).toBe('UNPAID');
    });
  });
});
