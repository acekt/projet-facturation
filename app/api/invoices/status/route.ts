import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import type { ErrorResponse } from '@/lib/types/api';

// Only these statuses are acceptable as forced overrides by an admin.
// UNPAID / PARTIALLY_PAID / PAID are computed automatically by payments.
// This route exists ONLY for exceptional administrative corrections.
const ADMIN_FORCEABLE_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'overdue', 'cancelled'] as const;
type ForceableStatus = typeof ADMIN_FORCEABLE_STATUSES[number];

export async function PATCH(request: Request) {
  try {
    // --- AUTH: Must be authenticated ---
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' } as ErrorResponse, { status: 401 });
    }

    // --- RBAC: Restricted to admin only ---
    // Operators must never be able to manually force an invoice status.
    // Status transitions are driven exclusively by the payment engine.
    if (session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accès refusé. La modification manuelle du statut est réservée aux administrateurs.' } as ErrorResponse,
        { status: 403 }
      );
    }
    if (!session.userId) {
      return NextResponse.json({ error: 'User ID manquant dans la session' } as ErrorResponse, { status: 400 });
    }

    const body = await request.json();
    const { invoiceId, status } = body as { invoiceId?: string; status?: unknown };

    // --- INPUT VALIDATION ---
    if (!invoiceId || typeof invoiceId !== 'string') {
      return NextResponse.json({ error: 'invoiceId manquant ou invalide.' } as ErrorResponse, { status: 400 });
    }

    if (!ADMIN_FORCEABLE_STATUSES.includes(status as ForceableStatus)) {
      return NextResponse.json(
        { error: `Statut invalide. Valeurs acceptées: ${ADMIN_FORCEABLE_STATUSES.join(', ')}` } as ErrorResponse,
        { status: 400 }
      );
    }

    // --- SOFT-DELETE GUARD: Block mutations on deleted invoices ---
    // The WHERE clause enforces that the invoice exists AND is not soft-deleted.
    // If deletedAt IS NOT NULL, changes.changes === 0 and we return 404.
    const result = db
      .prepare('UPDATE invoices SET status = ? WHERE id = ? AND deletedAt IS NULL')
      .run(status, invoiceId);

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Facture introuvable ou supprimée. Mise à jour impossible.' } as ErrorResponse,
        { status: 404 }
      );
    }

    // Audit trail: record every forced status change for compliance
    logAudit('UPDATE', 'invoice', invoiceId, `Statut forcé manuellement par admin: ${status}`, session.userId, session.name || session.username || null);

    return NextResponse.json({ success: true, invoiceId, newStatus: status });
  } catch (error) {
    console.error('[API Invoice Status PATCH] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur lors de la mise à jour du statut.' } as ErrorResponse, { status: 500 });
  }
}
