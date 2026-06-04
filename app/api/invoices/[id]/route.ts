import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND deletedAt IS NULL').get(id);
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const items = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(id);
    const payments = db.prepare('SELECT * FROM payments WHERE invoiceId = ?').all(id);

    return NextResponse.json({ ...invoice, items, payments });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}

// RULE 2: Invoices are strictly immutable once generated. Block any updates.
export async function PUT() {
  return NextResponse.json({ error: 'Une facture générée est strictement immuable et ne peut pas être modifiée.' }, { status: 405 });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { deleteQuote = false, userRole = 'user', restore = false } = body;

    // Restore functionality
    if (restore) {
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      if (!invoice.deletedAt) return NextResponse.json({ error: 'Invoice is not cancelled' }, { status: 400 });

      // Check if invoice was cancelled more than 3 days ago
      const cancelledDate = new Date(invoice.deletedAt);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      if (cancelledDate < threeDaysAgo && userRole !== 'admin') {
        return NextResponse.json({ error: 'Les factures annulées depuis plus de 3 jours ne peuvent être restaurées que par un administrateur' }, { status: 403 });
      }

      // Restore invoice
      const result = db.prepare("UPDATE invoices SET deletedAt = NULL, status = 'UNPAID' WHERE id = ?").run(id);
      
      if (result.changes === 0) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    // Get invoice details
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND deletedAt IS NULL').get(id) as any;
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    // Check if invoice is older than 3 days and user is not admin
    const invoiceDate = new Date(invoice.date);
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    if (invoiceDate < threeDaysAgo && userRole !== 'admin') {
      return NextResponse.json({ error: 'Les factures de plus de 3 jours ne peuvent être annulées que par un administrateur' }, { status: 403 });
    }

    // RULE 5: Enforce Soft Delete to maintain fiscal audit trail
    const result = db.prepare("UPDATE invoices SET deletedAt = datetime('now'), status = 'cancelled' WHERE id = ?").run(id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
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
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}
