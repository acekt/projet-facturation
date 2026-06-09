import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import { clientSchema } from '@/lib/validations';
import crypto from 'crypto';
import type { ClientCreateRequest, ClientResponse, ErrorResponse, DbClient } from '@/lib/types/api';

/**
 * GET /api/clients
 * Fetch all clients
 * @returns {ClientResponse[]} Array of clients
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

    const clients = db.prepare('SELECT * FROM clients WHERE deletedAt IS NULL ORDER BY name ASC').all() as DbClient[];
    return NextResponse.json(clients);
  } catch (error) {
    console.error('[API Clients GET] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch clients',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * POST /api/clients
 * Create a new client
 * @param {ClientCreateRequest} body - Client data
 * @returns {ClientResponse} Created client
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

    const body: unknown = await request.json();

    // Validate request payload with Zod
    const validation = clientSchema.safeParse(body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Données invalides',
        details: {
          fieldErrors: validation.error.flatten().fieldErrors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { name, email, phone, address }: ClientCreateRequest = validation.data;
    const id = crypto.randomUUID();

    db.prepare('INSERT INTO clients (id, name, email, phone, address) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, email, phone, address);

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as DbClient;
    return NextResponse.json(client);
  } catch (error) {
    console.error('[API Clients POST] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to create client',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
