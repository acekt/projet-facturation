import { redirect } from 'next/navigation';
import db from '@/lib/db';
import LoginClient from './login-client';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const result = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number } | undefined;
  const userCount = result?.c || 0;
  if (userCount === 0) {
    redirect('/setup');
  }
  return <LoginClient />;
}
