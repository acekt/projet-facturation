"use server";

import { getSession } from '@/lib/api/auth';
import { StockRepository } from '@/lib/repositories/StockRepository';

export async function getStockCatalog() {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  try {
    const data = StockRepository.getStockCatalog(session.userId, session.tenantId);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getStockMovements(serviceId: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  try {
    const data = StockRepository.getStockMovements(serviceId, session.userId, session.tenantId);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getLowStockAlerts() {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  try {
    const data = StockRepository.getLowStockAlerts(session.userId, session.tenantId);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function recordStockMovement(data: { serviceId: string; type: 'INVENTORY_IN' | 'INVENTORY_OUT' | 'INVOICE_DEDUCTION' | 'CREDIT_NOTE_RESTOCK'; quantity: number; referenceDoc?: string; notes?: string; }) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (session.role !== 'admin' && data.type !== 'INVOICE_DEDUCTION' && data.type !== 'CREDIT_NOTE_RESTOCK') {
    return { success: false, error: 'Forbidden' };
  }

  try {
    const result = StockRepository.recordStockMovement(data, session.userId, session.tenantId);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
