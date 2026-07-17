import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import db from '@/lib/db';
import { clientSchema } from '@/lib/validations';
import crypto from 'crypto';
import type { ClientCreateRequest, ClientResponse, ErrorResponse, DbClient } from '@/lib/types/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const response = NextResponse.json(clients);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
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
    if (!session.userId) {
      const errorResponse: ErrorResponse = {
        error: 'User ID manquant dans la session',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }
    if (session.role !== 'admin') {
      const errorResponse: ErrorResponse = {
        error: 'Forbidden',
      };
      return NextResponse.json(errorResponse, { status: 403 });
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

    // Check for duplicate email for the same user
    if (email) {
      const duplicate = db.prepare('SELECT id FROM clients WHERE lower(email) = lower(?) AND created_by = ? AND deletedAt IS NULL').get(email, session.userId);
      if (duplicate) {
        const errorResponse: ErrorResponse = {
          error: 'Un client avec cette adresse email existe déjà',
        };
        return NextResponse.json(errorResponse, { status: 409 });
      }
    }

    const id = crypto.randomUUID();

    db.prepare('INSERT INTO clients (id, name, email, phone, address, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, name, email, phone, address, session.userId);

    logAudit('CREATE', 'client', id, `Nouveau client créé: ${name}`, session.userId, session.name || session.username || null);

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
