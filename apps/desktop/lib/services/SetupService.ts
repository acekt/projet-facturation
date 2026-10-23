import db from '@/lib/db';
import crypto from 'crypto';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { SettingsRepository } from '@/lib/repositories/SettingsRepository';

export const SetupService = {
  isInitialized(): boolean {
    const countResult = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number } | undefined;
    return (countResult?.c || 0) > 0;
  },

  initializeApp(data: any, hashedPassword: string): { userId: string; tenantId: string; cleanName: string; cleanEmail: string } {
    const userId = crypto.randomUUID();
    const defaultTenantId = crypto.randomUUID();
    const cleanEmail = data.email.toLowerCase().trim();
    const cleanName = data.name.trim();

    let finalUserId: string = userId;
    let finalTenantId: string = defaultTenantId;

    const setupTransaction = db.transaction(() => {
      const existingUser = db.prepare('SELECT id, tenant_id FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?').get(cleanEmail, cleanEmail) as { id: string; tenant_id?: string | null } | undefined;

      if (existingUser) {
        finalUserId = existingUser.id;
        finalTenantId = existingUser.tenant_id || defaultTenantId;
        db.prepare('UPDATE users SET password = ?, name = ?, role = "admin", is_active = 1, phone = ?, tenant_id = ? WHERE id = ?')
          .run(hashedPassword, cleanName, data.phone || null, finalTenantId, finalUserId);
      } else {
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
          created_by: null,
          tenant_id: finalTenantId
        });
      }

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

    return { userId: finalUserId, tenantId: finalTenantId, cleanName, cleanEmail };
  }
};
