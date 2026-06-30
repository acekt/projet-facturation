import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import { updateInvoiceStatus } from '@/lib/api/invoice-logic';
import type { ErrorResponse, DbPayment } from '@/lib/types/api';

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
