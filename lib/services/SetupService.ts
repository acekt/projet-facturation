import db from '@/lib/db';
import crypto from 'crypto';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { SettingsRepository } from '@/lib/repositories/SettingsRepository';

export const SetupService = {
  isInitialized(): boolean {
    const countResult = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number } | undefined;
    return (countResult?.c || 0) > 0;
  },

  initializeApp(data: any, hashedPassword: string): { userId: string; cleanName: string; cleanEmail: string } {
    const userId = crypto.randomUUID();
    const cleanEmail = data.email.toLowerCase().trim();
    const cleanName = data.name.trim();

    const setupTransaction = db.transaction(() => {
      // Double check inside transaction for strict concurrency safety
      if (this.isInitialized()) {
        throw new Error('ALREADY_INITIALIZED');
      }

      UserRepository.create({
        id: userId,
        username: cleanEmail,
        email: cleanEmail,
        password: hashedPassword,
        name: cleanName,
        role: 'admin',
        is_active: 1,
        force_password_change: 0,
        phone: data.phone || null,
        created_by: null
      });

      SettingsRepository.upsertInitialSettings(
        data.companyName || '',
        data.nif || '',
        data.rccm || '',
        data.address || '',
        data.companyPhone || '',
        data.companyEmail || ''
      );
    });

    setupTransaction();

    return { userId, cleanName, cleanEmail };
  }
};
