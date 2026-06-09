import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import type { ErrorResponse, DbPayment, DbInvoice, DbTotal } from '@/lib/types/api';

/**
 * CRITICAL: Update invoice status based on exact remaining balance calculation
 * Uses Math.round() on all amounts to ensure precise decimal handling
 * Excludes soft-deleted payments (deletedAt IS NOT NULL) from calculations
 * Status transition: UNPAID (0) → PARTIALLY_PAID (0 < x < total) → PAID (x >= total)
 */
function updateInvoiceStatus(invoiceId: string): 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' {
  // Get invoice total (excluding soft-deleted invoices)
  const invoice = db.prepare('SELECT total FROM invoices WHERE id = ? AND deletedAt IS NULL').get(invoiceId) as DbInvoice | undefined;
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Get sum of payments, EXCLUDING soft-deleted payments
  const paymentsResult = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE invoiceId = ? AND deletedAt IS NULL').get(invoiceId) as DbTotal;
  
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // RBAC Check - Only Admin can delete payments
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      const errorResponse: ErrorResponse = {
        error: 'Forbidden: Only Admin can delete payments',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    // Get payment details before soft delete
    const payment = db.prepare('SELECT invoiceId FROM payments WHERE id = ? AND deletedAt IS NULL').get(id) as DbPayment | undefined;
    if (!payment) {
      const errorResponse: ErrorResponse = {
        error: 'Payment not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const deleteResult = db.transaction(() => {
      // Soft delete the payment (set deletedAt instead of hard DELETE)
      db.prepare("UPDATE payments SET deletedAt = datetime('now') WHERE id = ?").run(id);

      // Recalculate invoice status after soft delete
      const newStatus = updateInvoiceStatus(payment.invoiceId);
      return { success: true, newStatus };
    })();

    return NextResponse.json(deleteResult);
  } catch (error) {
    console.error('[API Payments DELETE] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to delete payment',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
