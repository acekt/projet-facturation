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

    // ── UPSERT via INSERT OR REPLACE ─────────────────────────────────────
    // Problème du simple UPDATE : si la ligne id=1 n'existe pas (première
    // configuration en production), UPDATE ne fait rien (changes=0) mais
    // ne lève PAS d'exception → l'API retourne silencieusement une erreur.
    //
    // INSERT OR REPLACE supprime l'ancienne ligne (si elle existe) et insère
    // la nouvelle, garantissant que la ligne id=1 existe toujours après l'appel.
    // C'est l'équivalent SQLite d'un UPSERT atomique.
    // ─────────────────────────────────────────────────────────────────────
    const fields = Object.keys(data);
    const columns = ['id', ...fields].join(', ');
    const placeholders = ['1', ...fields.map(() => '?')].join(', ');
    const values = Object.values(data);

    try {
      const result = db.prepare(
        `INSERT OR REPLACE INTO settings (${columns}) VALUES (${placeholders})`
      ).run(...values);

      if (result.changes === 0) {
        // Ne devrait jamais arriver avec INSERT OR REPLACE, mais on le détecte quand même
        console.error('[API Settings PATCH] UPSERT a retourné changes=0 — inattendu.');
        return NextResponse.json(
          { error: "L'enregistrement n'a pas modifié la base de données." },
          { status: 500 }
        );
      }
    } catch (dbError: any) {
      // Expose le message SQLite exact (ex: "table has no column named X")
      // pour permettre le diagnostic sans accès au serveur.
      console.error('[API Settings PATCH] Erreur SQLite:', dbError);
      return NextResponse.json(
        {
          error: 'Erreur lors de l\'enregistrement des paramètres.',
          detail: dbError?.message ?? String(dbError),
        },
        { status: 500 }
      );
    }

    logAudit('UPDATE', 'settings', '1', 'Paramètres mis à jour', session.userId, session.name || session.username || null);

    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as DbSettings;
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('[API Settings PATCH] Erreur inattendue:', error);
    const errorResponse: ErrorResponse = {
      error: 'Erreur interne du serveur.',
      ...(process.env.NODE_ENV !== 'production' && { detail: error?.message }),
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export const PUT = PATCH;
export const POST = PATCH;
