import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import { getNextNumber } from '@/lib/api/numbering';
import db from '@/lib/db';
import { InvoiceRepository } from '@/lib/repositories/InvoiceRepository';
import type { InvoiceResponse, InvoiceItem, PaymentResponse, ErrorResponse, DbInvoice, DbInvoiceItem, DbPayment } from '@/lib/types/api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Authentication required',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    const invoice = InvoiceRepository.findById(id, session.userId, session.role);
    if (!invoice) {
      // Return 404 or 403 depending on whether it actually doesn't exist or just isn't theirs
      const exists = InvoiceRepository.findById(id);
      if (exists) {
        return NextResponse.json({ error: 'Forbidden: You can only access your own invoices' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
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

export async function PATCH() {
  const errorResponse: ErrorResponse = {
    error: 'Une facture générée est strictement immuable et ne peut pas être modifiée.',
  };
  return NextResponse.json(errorResponse, { status: 405 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // RBAC Check
    const session = await getSession();
    if (!session || !session.userId) {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Authentication required',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const { deleteQuote = false } = body as { deleteQuote?: boolean };

    // Get invoice details (ensuring RBAC in query)
    const invoice = InvoiceRepository.findById(id, session.userId, session.role);
    if (!invoice) {
      const exists = InvoiceRepository.findById(id);
      if (exists) {
        return NextResponse.json({ error: 'Forbidden: You can only delete your own invoices' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // RULE 5: Enforce Soft Delete to maintain fiscal audit trail
    const result = InvoiceRepository.softDelete(id, session.userId, session.role);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Invoice not found or unauthorized' }, { status: 404 });
    }

    // Convert linked quote back to draft status
    if (invoice.quoteId) {
      db.prepare("UPDATE quotes SET status = 'EN_ATTENTE' WHERE id = ?").run(invoice.quoteId);

      // If user chose to delete the quote as well, soft delete it
      if (deleteQuote) {
        db.prepare("UPDATE quotes SET deletedAt = datetime('now') WHERE id = ?").run(invoice.quoteId);
      }
    }

    // Automatically generate credit note (Avoir) if one does not already exist
    const existingCN = db.prepare('SELECT id FROM credit_notes WHERE invoiceId = ? AND deletedAt IS NULL').get(id);
    if (!existingCN) {
      db.exec("INSERT OR IGNORE INTO sequences (name, current_value) VALUES ('credit_note', 0)");
      const cnId = crypto.randomUUID();
      const cnNumber = getNextNumber('credit_note');
      const items = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(id) as DbInvoiceItem[];

      db.transaction(() => {
        db.prepare(`
          INSERT INTO credit_notes (
            id, number, invoiceId, clientId, clientName, date, reason,
            subtotal, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          cnId,
          cnNumber,
          invoice.id,
          invoice.clientId,
          invoice.clientName,
          new Date().toISOString().split('T')[0],
          `Annulation de facture ${invoice.number}`,
          invoice.subtotal,
          invoice.taxBase,
          invoice.tvaAmount,
          invoice.tpsAmount ?? 0,
          invoice.cssAmount ?? 0,
          invoice.total,
          'open',
          session.userId
        );

        const insertCNItem = db.prepare(`
          INSERT INTO credit_note_items (id, creditNoteId, description, quantity, unitPrice, total)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const item of items) {
          insertCNItem.run(
            crypto.randomUUID(),
            cnId,
            item.description,
            item.quantity,
            item.unitPrice,
            item.total
          );
        }
      })();
    }

    logAudit('DELETE', 'invoice', id, `Facture supprimée: ${invoice.number || id}`, session.userId, session.name || session.username || null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Invoices DELETE] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to delete invoice',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
