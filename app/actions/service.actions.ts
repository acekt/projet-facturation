"use server";

import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import db from '@/lib/db';
import { serviceSchema, serviceUpdateSchema } from '@/lib/validations';
import crypto from 'crypto';
import type { ServiceCreateRequest, ServiceUpdateRequest, DbService } from '@/lib/types/api';
import type { ActionResponse } from './client.actions';

export async function getServices(): Promise<ActionResponse<DbService[]>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const sql = 'SELECT * FROM services WHERE deletedAt IS NULL ORDER BY name ASC';
    const services = db.prepare(sql).all() as DbService[];
    return { success: true, data: services };
  } catch (error) {
    console.error('[Action getServices] Error:', error);
    return { success: false, error: 'Failed to fetch services' };
  }
}

export async function getServiceById(id: string): Promise<ActionResponse<DbService>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const service = db.prepare('SELECT * FROM services WHERE id = ? AND deletedAt IS NULL').get(id) as DbService | undefined;
    if (!service) return { success: false, error: 'Service not found' };

    return { success: true, data: service };
  } catch (error) {
    console.error('[Action getServiceById] Error:', error);
    return { success: false, error: 'Failed to fetch service' };
  }
}

export async function createService(data: ServiceCreateRequest): Promise<ActionResponse<DbService>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };
    if (session.role !== 'admin') return { success: false, error: 'Forbidden' };

    const validation = serviceSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const { name, description, category, unitPrice } = validation.data;
    const id = crypto.randomUUID();

    db.prepare('INSERT INTO services (id, name, description, category, unitPrice, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, name, description, category, Math.round(unitPrice), session.userId);

    logAudit('CREATE', 'service', id, `Nouveau service créé: ${name}`, session.userId, session.name || session.username || null);

    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as DbService;
    return { success: true, data: service };
  } catch (error) {
    console.error('[Action createService] Error:', error);
    return { success: false, error: 'Failed to create service' };
  }
}

export async function updateService(id: string, data: ServiceUpdateRequest): Promise<ActionResponse<DbService>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };
    if (session.role !== 'admin') return { success: false, error: 'Forbidden' };

    const existingService = db.prepare('SELECT * FROM services WHERE id = ? AND deletedAt IS NULL').get(id) as DbService | undefined;
    if (!existingService) return { success: false, error: 'Service not found' };

    const validation = serviceUpdateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const { name, description, category, unitPrice } = validation.data;

    db.prepare('UPDATE services SET name = ?, description = ?, category = ?, unitPrice = ? WHERE id = ?')
      .run(name, description, category, Math.round(unitPrice), id);

    logAudit('UPDATE', 'service', id, `Service mis à jour: ${name}`, session.userId, session.name || session.username || null);

    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as DbService;
    return { success: true, data: service };
  } catch (error) {
    console.error('[Action updateService] Error:', error);
    return { success: false, error: 'Failed to update service' };
  }
}

export async function deleteService(id: string): Promise<ActionResponse<boolean>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };
    if (session.role !== 'admin') return { success: false, error: 'Forbidden' };

    const service = db.prepare('SELECT * FROM services WHERE id = ? AND deletedAt IS NULL').get(id) as DbService | undefined;
    if (!service) return { success: false, error: 'Service not found' };

    db.prepare("UPDATE services SET deletedAt = datetime('now') WHERE id = ?").run(id);
    logAudit('DELETE', 'service', id, `Service supprimé: ${service.name}`, session.userId, session.name || session.username || null);
    
    return { success: true, data: true };
  } catch (error) {
    console.error('[Action deleteService] Error:', error);
    return { success: false, error: 'Failed to delete service' };
  }
}
