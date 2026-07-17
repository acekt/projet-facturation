import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import { serviceUpdateSchema } from '@/lib/validations';
import { logAudit } from '@/lib/api/audit';
import type { ServiceUpdateRequest, ServiceResponse, ErrorResponse, DbService } from '@/lib/types/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/services/[id]
 * Fetch a specific service by ID
 * @param {string} id - Service ID
 * @returns {ServiceResponse} Service data
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
    const service = db.prepare('SELECT * FROM services WHERE id = ? AND deletedAt IS NULL').get(id) as DbService | undefined;
    if (!service) {
      const errorResponse: ErrorResponse = {
        error: 'Service not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }
    return NextResponse.json(service);
  } catch (error) {
    console.error('[API Services GET by ID] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch service',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * PATCH /api/services/[id]
 * Update a service
 * @param {string} id - Service ID
 * @param {ServiceUpdateRequest} body - Updated service data
 * @returns {ServiceResponse} Updated service
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

    const existingService = db.prepare('SELECT * FROM services WHERE id = ? AND deletedAt IS NULL').get(id) as DbService | undefined;
    if (!existingService) {
      const errorResponse: ErrorResponse = {
        error: 'Service not found',
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
    const validation = serviceUpdateSchema.safeParse(body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Données invalides',
        details: {
          fieldErrors: validation.error.flatten().fieldErrors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { name, description, category, unitPrice }: ServiceUpdateRequest = validation.data;

    db.prepare('UPDATE services SET name = ?, description = ?, category = ?, unitPrice = ? WHERE id = ?')
      .run(name, description, category, Math.round(unitPrice), id);

    logAudit('UPDATE', 'service', id, `Service mis à jour: ${name}`, session.userId, session.name || session.username || null);
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as DbService;
    return NextResponse.json(service);
  } catch (error) {
    console.error('[API Services PATCH] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to update service',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * DELETE /api/services/[id]
 * Soft delete a service
 * @param {string} id - Service ID
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

    const service = db.prepare('SELECT * FROM services WHERE id = ? AND deletedAt IS NULL').get(id) as DbService | undefined;
    if (!service) {
      const errorResponse: ErrorResponse = {
        error: 'Service not found',
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
    db.prepare("UPDATE services SET deletedAt = datetime('now') WHERE id = ?").run(id);
    logAudit('DELETE', 'service', id, `Service supprimé: ${service.name}`, session.userId, session.name || session.username || null);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Services DELETE] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to delete service',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
