import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { SetupService } from '@/lib/services/SetupService';
import LoginClient from './login-client';

export const instant = false;

export default async function LoginPage() {
  if (!SetupService.isInitialized()) {
    redirect('/setup');
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Chargement...</div>}>
      <LoginClient />
    </Suspense>
  );
}
