import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import { QuoteService, QuoteServiceError } from '@/lib/services/QuoteService';
import { quoteDuplicateSchema } from '@/lib/validations';
import type { QuoteDuplicateRequest, ErrorResponse } from '@/lib/types/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/quotes/duplicate
 * Duplique un devis existant avec un nouveau numéro DEV-xxx/CODE/YEAR.
 *
 * Accès :
 *  - Admin  → peut dupliquer n'importe quel devis
 *  - User   → peut dupliquer uniquement ses propres devis
 *
 * Comportement :
 *  - Le nouveau devis hérite de tous les champs du devis source (lignes, montants, client…)
 *  - Son statut est forcé à EN_ATTENTE (brouillon) indépendamment du statut source
 *  - Un audit log est écrit automatiquement par le service
 */
export async function POST(request: Request) {
  try {
    // 1. Authentification — session HMAC vérifiée par getSession()
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' } satisfies ErrorResponse,
        { status: 401 }
      );
    }

    // 2. Validation Zod du payload
    const body: unknown = await request.json();
    const validation = quoteDuplicateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Données invalides',
          details: { fieldErrors: validation.error.flatten().fieldErrors },
        } satisfies ErrorResponse,
        { status: 400 }
      );
    }

    const { quoteId }: QuoteDuplicateRequest = validation.data;

    // 3. Délégation au Service
    //    Le Service gère : vérification d'existence, RBAC ownership, transaction SQLite, audit log
    const result = QuoteService.duplicateQuote(quoteId, session.userId, session.role);
    return NextResponse.json(result);

  } catch (error) {
    if (error instanceof QuoteServiceError) {
      return NextResponse.json(
        { error: error.message } satisfies ErrorResponse,
        { status: error.status }
      );
    }
    console.error('[API Quotes Duplicate POST] Error:', error);
    return NextResponse.json(
      { error: 'Duplication failed' } satisfies ErrorResponse,
      { status: 500 }
    );
  }
}
