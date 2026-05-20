import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ? AND deletedAt IS NULL').get(id);
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    const items = db.prepare('SELECT * FROM quote_items WHERE quoteId = ?').all(id);
    return NextResponse.json({ ...quote, items });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    const quote = db.prepare('SELECT status, deletedAt FROM quotes WHERE id = ?').get(id) as any;
    if (!quote || quote.deletedAt !== null) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // RULE 3: A quote cannot be deleted if it has already been converted to an invoice
    if (quote.status === 'invoiced') {
        return NextResponse.json({ error: 'Impossible de supprimer un devis déjà converti en facture.' }, { status: 400 });
    }

    // RULE 5: Soft Delete
    db.prepare("UPDATE quotes SET deletedAt = datetime('now'), status = 'rejected' WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 });
  }
}
