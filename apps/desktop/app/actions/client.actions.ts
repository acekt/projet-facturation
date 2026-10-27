"use server";

import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import { buildTenantFilter, resolveActiveTenantId } from '@/lib/api/tenant';
import db from '@/lib/db';
import { clientSchema, clientUpdateSchema } from '@/lib/validations';
import crypto from 'crypto';
import type { ClientCreateRequest, ClientUpdateRequest, DbClient } from '@/lib/types/api';

export type ActionResponse<T> = 
  | { success: true; data: T; error?: never; details?: never }
  | { success: false; data?: never; error: string; details?: any };

export async function getClients(): Promise<ActionResponse<DbClient[]>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const tf = buildTenantFilter(activeTenantId);
    const sql = `SELECT * FROM clients WHERE deletedAt IS NULL${tf.sql} ORDER BY name ASC`;
    const clients = db.prepare(sql).all(...tf.params) as DbClient[];
    return { success: true, data: clients };
  } catch (error) {
    console.error('[Action getClients] Error:', error);
    return { success: false, error: 'Failed to fetch clients' };
  }
}

export async function getClientById(id: string): Promise<ActionResponse<DbClient>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const tf = buildTenantFilter(activeTenantId);
    const client = db.prepare(`SELECT * FROM clients WHERE id = ? AND deletedAt IS NULL${tf.sql}`).get(id, ...tf.params) as DbClient | undefined;
    if (!client) return { success: false, error: 'Client not found' };

    return { success: true, data: client };
  } catch (error) {
    console.error('[Action getClientById] Error:', error);
    return { success: false, error: 'Failed to fetch client' };
  }
}

export async function createClient(data: ClientCreateRequest): Promise<ActionResponse<DbClient>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };
    if (session.role !== 'admin' && session.role !== 'user') return { success: false, error: 'Forbidden' };

    const validation = clientSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const { name, email, phone, address, nif, rccm } = validation.data;
    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const tf = buildTenantFilter(activeTenantId);

    if (email && email.trim() !== '') {
      const duplicate = db.prepare(`SELECT id FROM clients WHERE lower(email) = lower(?) AND deletedAt IS NULL${tf.sql}`).get(email.trim(), ...tf.params);
      if (duplicate) return { success: false, error: 'Un client avec cette adresse email existe déjà' };
    }

    const id = crypto.randomUUID();
    db.prepare('INSERT INTO clients (id, name, email, phone, address, nif, rccm, created_by, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, name.trim(), email ? email.trim() : null, phone || null, address || null, nif ? nif.trim() : null, rccm ? rccm.trim() : null, session.userId, activeTenantId);

    logAudit('CREATE', 'client', id, `Nouveau client créé: ${name.trim()}`, session.userId, session.name || session.username || null, activeTenantId);

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as DbClient;
    return { success: true, data: client };
  } catch (error) {
    console.error('[Action createClient] Error:', error);
    return { success: false, error: 'Failed to create client' };
  }
}

export async function updateClient(id: string, data: ClientUpdateRequest): Promise<ActionResponse<DbClient>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };
    if (session.role !== 'admin' && session.role !== 'user') return { success: false, error: 'Forbidden' };

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const tf = buildTenantFilter(activeTenantId);
    const existingClient = db.prepare(`SELECT * FROM clients WHERE id = ? AND deletedAt IS NULL${tf.sql}`).get(id, ...tf.params) as DbClient | undefined;
    if (!existingClient) return { success: false, error: 'Client not found' };

    const validation = clientUpdateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const { name, email, phone, address, nif, rccm } = validation.data;

    if (email && email.trim() !== '') {
      const duplicate = db.prepare(`SELECT id FROM clients WHERE lower(email) = lower(?) AND id != ? AND deletedAt IS NULL${tf.sql}`).get(email.trim(), id, ...tf.params);
      if (duplicate) return { success: false, error: 'Un client avec cette adresse email existe déjà' };
    }

    db.prepare('UPDATE clients SET name = ?, email = ?, phone = ?, address = ?, nif = ?, rccm = ? WHERE id = ?')
      .run(name.trim(), email ? email.trim() : null, phone || null, address || null, nif ? nif.trim() : null, rccm ? rccm.trim() : null, id);

    logAudit('UPDATE', 'client', id, `Client mis à jour: ${name.trim()}`, session.userId, session.name || session.username || null, activeTenantId);

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as DbClient;
    return { success: true, data: client };
  } catch (error) {
    console.error('[Action updateClient] Error:', error);
    return { success: false, error: 'Failed to update client' };
  }
}

export async function deleteClient(id: string): Promise<ActionResponse<boolean>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) return { success: false, error: 'Unauthorized' };
    if (session.role !== 'admin') return { success: false, error: 'Forbidden' };

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const tf = buildTenantFilter(activeTenantId);
    const client = db.prepare(`SELECT * FROM clients WHERE id = ? AND deletedAt IS NULL${tf.sql}`).get(id, ...tf.params) as DbClient | undefined;
    if (!client) return { success: false, error: 'Client not found' };

    // Vérification de sécurité comptable : interdire la suppression si des factures impayées existent
    const activeInvoices = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as totalUnpaid 
      FROM invoices 
      WHERE clientId = ? AND status IN ('UNPAID', 'PARTIALLY_PAID') AND deletedAt IS NULL
    `).get(id) as { count: number; totalUnpaid: number } | undefined;

    if (activeInvoices && activeInvoices.count > 0) {
      return {
        success: false,
        error: `Impossible de supprimer ce client : ${activeInvoices.count} facture(s) impayée(s) en cours (Total restant : ${Math.round(activeInvoices.totalUnpaid).toLocaleString('fr-FR')} FCFA). Veuillez d'abord régulariser ces factures.`
      };
    }

    db.prepare("UPDATE clients SET deletedAt = datetime('now') WHERE id = ?").run(id);
    logAudit('DELETE', 'client', id, `Client supprimé: ${client.name}`, session.userId, session.name || session.username || null, activeTenantId);
    
    return { success: true, data: true };
  } catch (error) {
    console.error('[Action deleteClient] Error:', error);
    return { success: false, error: 'Failed to delete client' };
  }
}
