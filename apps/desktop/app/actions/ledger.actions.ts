"use server";

import { getSession } from '@/lib/api/auth';
import { resolveActiveTenantId } from '@/lib/api/tenant';
import { LedgerRepository, LedgerEntry, LedgerFilters, LedgerSummary } from '@/lib/repositories/LedgerRepository';
import type { ActionResponse } from './client.actions';
import { ledgerEntryCreateSchema, type LedgerEntryCreateRequest } from '@/lib/validations/ledger';
import { logAudit } from '@/lib/api/audit';

export type { LedgerEntryCreateRequest };

export async function getLedgerEntriesAction(filters: Omit<LedgerFilters, 'tenantId'>): Promise<ActionResponse<LedgerEntry[]>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    if (!activeTenantId) return { success: false, error: 'Tenant introuvable' };

    const entries = LedgerRepository.findAll({
      ...filters,
      tenantId: activeTenantId
    });

    return { success: true, data: entries };
  } catch (error) {
    console.error('[Action getLedgerEntriesAction] Error:', error);
    return { success: false, error: 'Failed to fetch ledger entries' };
  }
}

export async function getLedgerSummaryAction(filters: Omit<LedgerFilters, 'tenantId'>): Promise<ActionResponse<LedgerSummary>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    if (!activeTenantId) return { success: false, error: 'Tenant introuvable' };

    const summary = LedgerRepository.getSummary({
      ...filters,
      tenantId: activeTenantId
    });

    return { success: true, data: summary };
  } catch (error) {
    console.error('[Action getLedgerSummaryAction] Error:', error);
    return { success: false, error: 'Failed to fetch ledger summary' };
  }
}

export async function createLedgerEntryAction(data: LedgerEntryCreateRequest): Promise<ActionResponse<LedgerEntry>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };

    // Authorization check could be added here if only certain roles can create manual entries
    if (session.role !== 'admin' && session.role !== 'user') return { success: false, error: 'Unauthorized' };

    const validation = ledgerEntryCreateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    if (!activeTenantId) return { success: false, error: 'Tenant introuvable' };

    const entry = LedgerRepository.create({
      ...validation.data,
      tenant_id: activeTenantId,
      created_by: session.userId,
    });

    logAudit('CREATE', 'ledger_entry', entry.id, `Création écriture ${entry.type} de ${entry.amount} XAF`, session.userId, session.name || session.username || null, activeTenantId);

    return { success: true, data: entry };
  } catch (error) {
    console.error('[Action createLedgerEntryAction] Error:', error);
    return { success: false, error: 'Failed to create ledger entry' };
  }
}

export async function deleteLedgerEntryAction(id: string): Promise<ActionResponse<boolean>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };

    // Typically only admins should delete entries
    if (session.role !== 'admin') return { success: false, error: 'Forbidden: Only Admin can delete ledger entries' };

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    if (!activeTenantId) return { success: false, error: 'Tenant introuvable' };

    const success = LedgerRepository.softDelete(id, activeTenantId, session.userId, session.name || session.username || undefined);

    if (!success) {
        return { success: false, error: 'Entry not found or could not be deleted' };
    }

    return { success: true, data: true };
  } catch (error) {
    console.error('[Action deleteLedgerEntryAction] Error:', error);
    return { success: false, error: 'Failed to delete ledger entry' };
  }
}
