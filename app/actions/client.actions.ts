"use server";

import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
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

    const sql = 'SELECT * FROM clients WHERE deletedAt IS NULL ORDER BY name ASC';
    const clients = db.prepare(sql).all() as DbClient[];
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

    const client = db.prepare('SELECT * FROM clients WHERE id = ? AND deletedAt IS NULL').get(id) as DbClient | undefined;
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
    if (session.role !== 'admin') return { success: false, error: 'Forbidden' };

    const validation = clientSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const { name, email, phone, address } = validation.data;

    if (email) {
      const duplicate = db.prepare('SELECT id FROM clients WHERE lower(email) = lower(?) AND created_by = ? AND deletedAt IS NULL').get(email, session.userId);
      if (duplicate) return { success: false, error: 'Un client avec cette adresse email existe déjà' };
    }

    const id = crypto.randomUUID();
    db.prepare('INSERT INTO clients (id, name, email, phone, address, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, name, email, phone, address, session.userId);

    logAudit('CREATE', 'client', id, `Nouveau client créé: ${name}`, session.userId, session.name || session.username || null);

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
    if (session.role !== 'admin') return { success: false, error: 'Forbidden' };

    const existingClient = db.prepare('SELECT * FROM clients WHERE id = ? AND deletedAt IS NULL').get(id) as DbClient | undefined;
    if (!existingClient) return { success: false, error: 'Client not found' };

    const validation = clientUpdateSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: 'Données invalides', details: validation.error.flatten().fieldErrors };
    }

    const { name, email, phone, address } = validation.data;

    db.prepare('UPDATE clients SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?')
      .run(name, email, phone, address, id);

    logAudit('UPDATE', 'client', id, `Client mis à jour: ${name}`, session.userId, session.name || session.username || null);

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

    const client = db.prepare('SELECT * FROM clients WHERE id = ? AND deletedAt IS NULL').get(id) as DbClient | undefined;
    if (!client) return { success: false, error: 'Client not found' };

    db.prepare("UPDATE clients SET deletedAt = datetime('now') WHERE id = ?").run(id);
    logAudit('DELETE', 'client', id, `Client supprimé: ${client.name}`, session.userId, session.name || session.username || null);
    
    return { success: true, data: true };
  } catch (error) {
    console.error('[Action deleteClient] Error:', error);
    return { success: false, error: 'Failed to delete client' };
  }
}
