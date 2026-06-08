import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import { clientUpdateSchema } from '@/lib/validations';
import { logAudit } from '@/lib/api/audit';
import type { ClientUpdateRequest, ClientResponse, ErrorResponse, DbClient } from '@/lib/types/api';

/**
 * GET /api/clients/[id]
 * Fetch a specific client by ID
 * @param {string} id - Client ID
 * @returns {ClientResponse} Client data
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
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
  { params }: { params: { id: string } }
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
    const body: unknown = await request.json();

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

    const result = db.prepare('UPDATE clients SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?')
      .run(name, email, phone, address, id);

    if (result.changes === 0) {
      const errorResponse: ErrorResponse = {
        error: 'Client not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    logAudit('UPDATE', 'client', id, `Client mis à jour: ${name}`);
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
 * Soft delete a client (Admin only)
 * @param {string} id - Client ID
 * @returns {{ success: boolean }} Success indicator
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    // RBAC Check - Only Admin can delete clients
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      const errorResponse: ErrorResponse = {
        error: 'Forbidden: Only Admin can delete clients',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    const client = db.prepare('SELECT name FROM clients WHERE id = ? AND deletedAt IS NULL').get(id) as DbClient | undefined;
    if (!client) {
      const errorResponse: ErrorResponse = {
        error: 'Client not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Soft delete
    db.prepare("UPDATE clients SET deletedAt = datetime('now') WHERE id = ?").run(id);
    logAudit('DELETE', 'client', id, `Client supprimé: ${client.name}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Clients DELETE] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to delete client',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
