import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import { serviceUpdateSchema } from '@/lib/validations';
import { logAudit } from '@/lib/api/audit';
import type { ServiceUpdateRequest, ServiceResponse, ErrorResponse, DbService } from '@/lib/types/api';

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

    logAudit('UPDATE', 'service', id, `Service mis à jour: ${name}`);
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
 * Soft delete a service (Admin only)
 * @param {string} id - Service ID
 * @returns {{ success: boolean }} Success indicator
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // RBAC Check - Authenticated users (admin & operator) can soft-delete services
    const session = await getSession();
    if (!session) {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Authentication required',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    const service = db.prepare('SELECT name FROM services WHERE id = ? AND deletedAt IS NULL').get(id) as DbService | undefined;
    if (!service) {
      const errorResponse: ErrorResponse = {
        error: 'Service not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Soft delete
    db.prepare("UPDATE services SET deletedAt = datetime('now') WHERE id = ?").run(id);
    logAudit('DELETE', 'service', id, `Service supprimé: ${service.name}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Services DELETE] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to delete service',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
