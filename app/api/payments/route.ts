import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import db from '@/lib/db';
import crypto from 'crypto';
import { paymentCreateSchema } from '@/lib/validations';
import { updateInvoiceStatus } from '@/lib/api/invoice-logic';
import type { PaymentCreateRequest, PaymentResponse, ErrorResponse, DbPayment } from '@/lib/types/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' } as ErrorResponse, { status: 401 });
    }

    let query = 'SELECT * FROM payments WHERE deletedAt IS NULL';
    const params: unknown[] = [];
    if (session.role !== 'admin') {
      query += ' AND created_by = ?';
      params.push(session.userId);
    }
    query += ' ORDER BY createdAt DESC';

    const payments = db.prepare(query).all(...params) as DbPayment[];
    const paymentResponses: PaymentResponse[] = payments.map((payment): PaymentResponse => ({
      id: payment.id,
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      date: payment.date,
      reference: payment.reference,
      createdAt: payment.createdAt,
      deletedAt: payment.deletedAt,
      created_by: payment.created_by,
    }));

    const response = NextResponse.json(paymentResponses);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
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
    const session = await getSession();
    if (!session) {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Authentication required',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }
    if (!session.userId) {
      const errorResponse: ErrorResponse = {
        error: 'User ID manquant dans la session',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }
    if (session.role === 'admin') {
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

    // Check if invoice exists and is not soft deleted
    const invoice = db.prepare('SELECT total, created_by FROM invoices WHERE id = ? AND deletedAt IS NULL').get(invoiceId) as { total: number; created_by?: string } | undefined;
    if (!invoice) {
      const errorResponse: ErrorResponse = {
        error: 'Facture introuvable ou supprimée',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Check RLS: user can only pay their own invoices unless admin
    if (session.role !== 'admin' && invoice.created_by !== session.userId) {
      const errorResponse: ErrorResponse = {
        error: 'Forbidden: You can only record payments for your own invoices',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    // Check overpayment (Trop-perçu)
    const paidResult = db.prepare('SELECT COALESCE(SUM(amount), 0) as totalPaid FROM payments WHERE invoiceId = ? AND deletedAt IS NULL').get(invoiceId) as { totalPaid: number };
    const totalPaid = Math.round(paidResult.totalPaid || 0);
    const totalTTC = Math.round(invoice.total);
    const remaining = totalTTC - totalPaid;

    if (Math.round(amount) > remaining) {
      const errorResponse: ErrorResponse = {
        error: `Le montant du paiement (${amount} XAF) excède le reste à charge de la facture (${remaining} XAF)`,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const id = crypto.randomUUID();

    const insertPayment = db.transaction(() => {
      db.prepare(`
        INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, invoiceId, Math.round(amount), paymentMethod, date, reference || null, session.userId);

      const newStatus = updateInvoiceStatus(invoiceId);
      logAudit('CREATE', 'payment', id, `Paiement enregistré: ${amount} XAF sur facture ${invoiceId}`, session.userId, session.name || session.username || null);
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
