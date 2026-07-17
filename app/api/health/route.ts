import { NextResponse } from 'next/server';

/**
 * Health Check Endpoint — L'Étoile
 * =================================
 * Permet au processus principal Electron (main.js) de vérifier
 * que le serveur Next.js est pleinement démarré et prêt à servir
 * l'application avant d'afficher la fenêtre principale (Splash Screen lock).
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { status: 'ok', timestamp: Date.now() },
    { status: 200 }
  );
}
