import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    db.transaction(() => {
      // Typically, you shouldn't delete a client if they have invoices/quotes,
      // but for this prototype, we'll just delete the client.
      // A more robust solution would be to soft-delete or check for dependencies.
      db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    })();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
