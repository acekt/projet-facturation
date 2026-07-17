import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import db from '@/lib/db';
import { settingsSchema } from '@/lib/validations';
import type { SettingsUpdateRequest, SettingsResponse, ErrorResponse, DbSettings } from '@/lib/types/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings
 * Fetch application settings
 * @returns {SettingsResponse} Application settings
 */
export async function GET() {
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as DbSettings | undefined;
    if (!settings) {
      const errorResponse: ErrorResponse = {
        error: 'Settings not found',
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[API Settings GET] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch settings',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * PATCH /api/settings
 * Update application settings (Admin only)
 * @param {SettingsUpdateRequest} body - Settings to update
 * @returns {SettingsResponse} Updated settings
 */
export async function PATCH(request: Request) {
  try {
    // RBAC Check - Only Admin can update settings
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      const errorResponse: ErrorResponse = {
        error: 'Forbidden: Admin access required',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }
    if (!session.userId) {
      const errorResponse: ErrorResponse = {
        error: 'User ID manquant dans la session',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const body: unknown = await request.json();

    // Validate request payload with Zod
    const validation = settingsSchema.safeParse(body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Données invalides',
        details: {
          fieldErrors: validation.error.flatten().fieldErrors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const data: SettingsUpdateRequest = validation.data;
    const fields = Object.keys(data);
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = Object.values(data);

    db.prepare(`UPDATE settings SET ${setClause} WHERE id = 1`).run(...values);

    logAudit('UPDATE', 'settings', '1', 'Paramètres mis à jour', session.userId, session.name || session.username || null);

    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as DbSettings;
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[API Settings PATCH] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to update settings',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export const PUT = PATCH;
export const POST = PATCH;
