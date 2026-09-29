import { redirect } from 'next/navigation';
import db from '@/lib/db';
import LoginClient from './login-client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';

export default async function LoginPage() {
  let userCount = 0;
  
  // Isolation stricte de la requête pour éviter que 'no such table' ne crashe le composant
  try {
    const result = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number } | undefined;
    userCount = result?.c || 0;
  } catch (error) {
    // Si la table n'existe pas encore (race condition au démarrage), la base est vierge.
    userCount = 0;
  }

  // Le redirect DOIT être en dehors du try/catch pour que Next.js puisse intercepter l'erreur NEXT_REDIRECT
  if (userCount === 0) {
    redirect('/setup');
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Chargement...</div>}>
      <LoginClient />
    </Suspense>
  );
}
