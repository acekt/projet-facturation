import { Suspense } from 'react';
import LoginClient from './login-client';

export const instant = false;

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Chargement...</div>}>
      <LoginClient />
    </Suspense>
  );
}
