import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import { clientUpdateSchema } from '@/lib/validations';
import { logAudit } from '@/lib/api/audit';
import type { ClientUpdateRequest, ClientResponse, ErrorResponse, DbClient } from '@/lib/types/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/clients/[id]
 * Fetch a specific client by ID
 * @param {string} id - Client ID
 * @returns {ClientResponse} Client data
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // RBAC Check
    const session = await getSession();
    if (!session) {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Authentication required',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    const { id } = await params;
    const client = db.prepare('SELECT * FROM clients WHERE id = ? AND deletedAt IS NULL').get(id) as DbClient | undefined;
    if (!client) {
      const errorResponse: ErrorResponse = {
        error: 'Client not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error('[API Clients GET by ID] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch client',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * PATCH /api/clients/[id]
 * Update a client
 * @param {string} id - Client ID
 * @param {ClientUpdateRequest} body - Updated client data
 * @returns {ClientResponse} Updated client
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Authentication required',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }
    if (!session.userId) {
      const errorResponse: ErrorResponse = {
        error: 'User ID manquant dans la session',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { id } = await params;

    const existingClient = db.prepare('SELECT * FROM clients WHERE id = ? AND deletedAt IS NULL').get(id) as DbClient | undefined;
    if (!existingClient) {
      const errorResponse: ErrorResponse = {
        error: 'Client not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    if (session.role !== 'admin') {
      const errorResponse: ErrorResponse = {
        error: 'Forbidden',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    let body: unknown = {};
    try {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      const errorResponse: ErrorResponse = { error: 'Payload JSON invalide' };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate request payload with Zod
    const validation = clientUpdateSchema.safeParse(body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Données invalides',
        details: {
          fieldErrors: validation.error.flatten().fieldErrors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { name, email, phone, address }: ClientUpdateRequest = validation.data;

    db.prepare('UPDATE clients SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?')
      .run(name, email, phone, address, id);

    logAudit('UPDATE', 'client', id, `Client mis à jour: ${name}`, session.userId, session.name || session.username || null);
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as DbClient;
    return NextResponse.json(client);
  } catch (error) {
    console.error('[API Clients PATCH] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to update client',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * DELETE /api/clients/[id]
 * Soft delete a client
 * @param {string} id - Client ID
 * @returns {{ success: boolean }} Success indicator
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getSession();
    if (!session) {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Authentication required',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }
    if (!session.userId) {
      const errorResponse: ErrorResponse = {
        error: 'User ID manquant dans la session',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const client = db.prepare('SELECT * FROM clients WHERE id = ? AND deletedAt IS NULL').get(id) as DbClient | undefined;
    if (!client) {
      const errorResponse: ErrorResponse = {
        error: 'Client not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    if (session.role !== 'admin') {
      const errorResponse: ErrorResponse = {
        error: 'Forbidden',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    // Soft delete
    db.prepare("UPDATE clients SET deletedAt = datetime('now') WHERE id = ?").run(id);
    logAudit('DELETE', 'client', id, `Client supprimé: ${client.name}`, session.userId, session.name || session.username || null);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Clients DELETE] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to delete client',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
