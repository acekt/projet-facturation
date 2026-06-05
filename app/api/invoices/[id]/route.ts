import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import type { InvoiceResponse, InvoiceItem, PaymentResponse, ErrorResponse, DbInvoice, DbInvoiceItem, DbPayment } from '@/lib/types/api';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND deletedAt IS NULL').get(id) as DbInvoice | undefined;
    if (!invoice) {
      const errorResponse: ErrorResponse = {
        error: 'Invoice not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const items = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(id) as DbInvoiceItem[];
    const payments = db.prepare('SELECT * FROM payments WHERE invoiceId = ? AND deletedAt IS NULL').all(id) as DbPayment[];

    const response: InvoiceResponse = {
      ...invoice,
      items: items.map((item): InvoiceItem => ({
        id: item.id,
        invoiceId: item.invoiceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      payments: payments.map((payment): PaymentResponse => ({
        id: payment.id,
        invoiceId: payment.invoiceId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        date: payment.date,
        reference: payment.reference,
        createdAt: payment.createdAt,
        deletedAt: payment.deletedAt,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API Invoices GET by ID] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch invoice',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// RULE 2: Invoices are strictly immutable once generated. Block any updates.
export async function PUT() {
  const errorResponse: ErrorResponse = {
    error: 'Une facture générée est strictement immuable et ne peut pas être modifiée.',
  };
  return NextResponse.json(errorResponse, { status: 405 });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    // RBAC Check - Only Admin can delete invoices
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      const errorResponse: ErrorResponse = {
        error: 'Forbidden: Only Admin can delete invoices',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { deleteQuote = false } = body as { deleteQuote?: boolean };

    // Get invoice details
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND deletedAt IS NULL').get(id) as DbInvoice | undefined;
    if (!invoice) {
      const errorResponse: ErrorResponse = {
        error: 'Invoice not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // RULE 5: Enforce Soft Delete to maintain fiscal audit trail
    const result = db.prepare("UPDATE invoices SET deletedAt = datetime('now'), status = 'cancelled' WHERE id = ?").run(id);

    if (result.changes === 0) {
      const errorResponse: ErrorResponse = {
        error: 'Invoice not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Convert linked quote back to draft status
    if (invoice.quoteId) {
      db.prepare("UPDATE quotes SET status = 'draft' WHERE id = ?").run(invoice.quoteId);

      // If user chose to delete the quote as well, soft delete it
      if (deleteQuote) {
        db.prepare("UPDATE quotes SET deletedAt = datetime('now') WHERE id = ?").run(invoice.quoteId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Invoices DELETE] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to delete invoice',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
