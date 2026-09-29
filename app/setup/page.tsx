import { redirect } from 'next/navigation';
import db from '@/lib/db';
import SetupClient from './setup-client';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  let userCount = 0;

  try {
    const result = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number } | undefined;
    userCount = result?.c || 0;
  } catch (error) {
    userCount = 0;
  }

  // Prévention stricte : si des utilisateurs existent, on bloque le setup
  if (userCount > 0) {
    redirect('/login');
  }

  return <SetupClient />;
}
