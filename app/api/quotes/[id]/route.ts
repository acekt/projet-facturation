import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id);
    
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    db.transaction(() => {
      db.prepare('DELETE FROM quote_items WHERE quoteId = ?').run(id);
      db.prepare('DELETE FROM quotes WHERE id = ?').run(id);
    })();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 });
  }
}
