import db from '@/lib/db';
import crypto from 'crypto';
import { resolveActiveTenantId, buildTenantFilter } from '@/lib/api/tenant';

export interface StockMovement {
  id: string;
  tenant_id: string;
  serviceId: string;
  type: 'INVENTORY_IN' | 'INVENTORY_OUT' | 'INVOICE_DEDUCTION' | 'CREDIT_NOTE_RESTOCK';
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceDoc?: string;
  notes?: string;
  created_by?: string;
  createdAt: string;
  updatedAt: string;
}

export const StockRepository = {
  getStockCatalog(userId: string, tenantId?: string | null) {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);
    return db.prepare(`SELECT * FROM services WHERE trackStock = 1 AND deletedAt IS NULL${tf.sql} ORDER BY name ASC`).all(...tf.params);
  },

  getStockMovements(serviceId: string, userId: string, tenantId?: string | null) {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);
    return db.prepare(`SELECT * FROM stock_movements WHERE serviceId = ? AND deletedAt IS NULL${tf.sql} ORDER BY createdAt DESC`).all(serviceId, ...tf.params);
  },

  getLowStockAlerts(userId: string, tenantId?: string | null) {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    const tf = buildTenantFilter(activeTenantId);
    return db.prepare(`SELECT * FROM services WHERE trackStock = 1 AND stockQuantity <= minStockAlert AND deletedAt IS NULL${tf.sql} ORDER BY stockQuantity ASC`).all(...tf.params);
  },

  recordStockMovement(
    data: {
      serviceId: string;
      type: 'INVENTORY_IN' | 'INVENTORY_OUT' | 'INVOICE_DEDUCTION' | 'CREDIT_NOTE_RESTOCK';
      quantity: number;
      referenceDoc?: string;
      notes?: string;
    },
    userId: string,
    tenantId?: string | null
  ) {
    const activeTenantId = resolveActiveTenantId(userId, tenantId);
    if (!activeTenantId) {
       throw new Error('Tenant ID is required to record stock movement');
    }

    const service = db.prepare('SELECT stockQuantity, trackStock FROM services WHERE id = ?').get(data.serviceId) as { stockQuantity: number, trackStock: number };

    if (!service) {
      throw new Error('Service not found');
    }

    if (service.trackStock !== 1) {
      throw new Error('This service does not track stock');
    }

    const previousStock = service.stockQuantity;
    let newStock = previousStock;

    if (data.type === 'INVENTORY_IN' || data.type === 'CREDIT_NOTE_RESTOCK') {
      newStock += data.quantity;
    } else if (data.type === 'INVENTORY_OUT' || data.type === 'INVOICE_DEDUCTION') {
      newStock -= data.quantity;
    }

    const id = crypto.randomUUID();

    db.transaction(() => {
      db.prepare('UPDATE services SET stockQuantity = ? WHERE id = ?').run(newStock, data.serviceId);
      db.prepare(`
        INSERT INTO stock_movements (id, tenant_id, serviceId, type, quantity, previousStock, newStock, referenceDoc, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, activeTenantId, data.serviceId, data.type, data.quantity, previousStock, newStock, data.referenceDoc || null, data.notes || null, userId);
    })();

    return { success: true, id, newStock };
  }
};
