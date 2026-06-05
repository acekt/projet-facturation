import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import crypto from 'crypto';
import { paymentCreateSchema } from '@/lib/validations';
import type { PaymentCreateRequest, PaymentResponse, ErrorResponse, DbPayment, DbInvoice, DbTotal } from '@/lib/types/api';

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

export async function GET() {
  try {
    const payments = db.prepare('SELECT * FROM payments WHERE deletedAt IS NULL ORDER BY createdAt DESC').all() as DbPayment[];
    const paymentResponses: PaymentResponse[] = payments.map((payment): PaymentResponse => ({
      id: payment.id,
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      date: payment.date,
      reference: payment.reference,
      createdAt: payment.createdAt,
      deletedAt: payment.deletedAt,
    }));

    return NextResponse.json(paymentResponses);
  } catch (error) {
    console.error('[API Payments GET] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch payments',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // RBAC Check
    const session = await getSession();
    if (!session) {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Authentication required',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId) as { role: string } | undefined;
    if (!user || user.role !== 'user') {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Only Users can record payments',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    const body: unknown = await request.json();

    // Validate request payload with Zod
    const validation = paymentCreateSchema.safeParse(body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Données invalides',
        details: {
          fieldErrors: validation.error.flatten().fieldErrors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { invoiceId, amount, paymentMethod, date, reference }: PaymentCreateRequest = validation.data;
    const id = crypto.randomUUID();

    const insertPayment = db.transaction(() => {
      db.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, invoiceId, Math.round(amount), paymentMethod, date, reference || null);

      const newStatus = updateInvoiceStatus(invoiceId);
      return { id, newStatus };
    });

    const result = insertPayment();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Payments POST] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to record payment',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
