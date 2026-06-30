import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/api/auth';
import type { ErrorResponse } from '@/lib/types/api';

const VALID_STATUSES = ['PAID', 'PARTIALLY_PAID', 'UNPAID', 'overdue', 'draft', 'cancelled'] as const;

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' } as ErrorResponse, { status: 401 });
    }

    const { invoiceId, status } = await request.json();

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Statut invalide' } as ErrorResponse, { status: 400 });
    }

    db.prepare("UPDATE invoices SET status = ? WHERE id = ?").run(status, invoiceId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Invoice Status PATCH] Error:', error);
    return NextResponse.json({ error: 'Failed to update status' } as ErrorResponse, { status: 500 });
  }
}
