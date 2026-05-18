import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id);
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

    const quote = db.prepare('SELECT status FROM quotes WHERE id = ?').get(id) as any;
    if (quote?.status === 'invoiced') {
        return NextResponse.json({ error: 'Cannot delete an invoiced quote' }, { status: 400 });
    }

    const result = db.prepare('DELETE FROM quotes WHERE id = ?').run(id);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 });
  }
}
