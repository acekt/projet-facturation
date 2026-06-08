import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import { serviceSchema } from '@/lib/validations';
import crypto from 'crypto';
import type { ServiceCreateRequest, ServiceResponse, ErrorResponse, DbService } from '@/lib/types/api';

/**
 * GET /api/services
 * Fetch all services
 * @returns {ServiceResponse[]} Array of services
 */
export async function GET() {
  try {
    // RBAC Check
    const session = await getSession();
    if (!session) {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Authentication required',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    const services = db.prepare('SELECT * FROM services WHERE deletedAt IS NULL ORDER BY name ASC').all() as DbService[];
    return NextResponse.json(services);
  } catch (error) {
    console.error('[API Services GET] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch services',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * POST /api/services
 * Create a new service
 * @param {ServiceCreateRequest} body - Service data
 * @returns {ServiceResponse} Created service
 */
export async function POST(request: Request) {
  try {
    // RBAC Check
    const session = await getSession();
    if (!session) {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Authentication required',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId) as { role: string } | undefined;
    if (!user || user.role !== 'user') {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized: Only Users can manage services',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    const body: unknown = await request.json();

    // Validate request payload with Zod
    const validation = serviceSchema.safeParse(body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Données invalides',
        details: {
          fieldErrors: validation.error.flatten().fieldErrors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { name, description, category, unitPrice }: ServiceCreateRequest = validation.data;
    const id = crypto.randomUUID();

    db.prepare('INSERT INTO services (id, name, description, category, unitPrice) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, description, category, Math.round(unitPrice));

    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as DbService;
    return NextResponse.json(service);
  } catch (error) {
    console.error('[API Services POST] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to create service',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
