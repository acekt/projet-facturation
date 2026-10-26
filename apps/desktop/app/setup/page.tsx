import { redirect } from 'next/navigation';
import { SetupService } from '@/lib/services/SetupService';
import SetupClient from './setup-client';

export const instant = false;

export default async function SetupPage() {
  if (SetupService.isInitialized()) {
    redirect('/login');
  }
  return <SetupClient />;
}
