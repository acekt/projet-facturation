import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db';
import { UserRepository } from '@/lib/repositories/UserRepository';
import {
  ADMIN_PERMISSIONS,
  USER_PERMISSIONS,
  getPermissionsForRole,
} from '@/lib/store';
import { navItems } from '@/components/layout/navigation';
import { changePasswordSchema } from '@/lib/validations';

describe('Phase 3 — RBAC Matrix Harmonization & Mandatory Password Change', () => {
  beforeEach(() => {
    db.exec(`
      DELETE FROM pending_cloud_members;
      DELETE FROM users;
    `);
  });

  describe('1. RBAC Matrix Alignment (store.ts & navigation.tsx)', () => {
    it('grants full access to admin across all store permissions', () => {
      const perms = getPermissionsForRole('admin');
      expect(perms).toEqual(ADMIN_PERMISSIONS);
      expect(perms.canViewDashboard).toBe(true);
      expect(perms.canViewSettings).toBe(true);
      expect(perms.canManageSettings).toBe(true);
      expect(perms.canViewAuditLog).toBe(true);
      expect(perms.canViewUsers).toBe(true);
      expect(perms.canManageUsers).toBe(true);
      expect(perms.canViewCustomers).toBe(true);
      expect(perms.canManageCustomers).toBe(true);
      expect(perms.canViewQuotes).toBe(true);
      expect(perms.canCreateQuote).toBe(true);
      expect(perms.canViewInvoices).toBe(true);
      expect(perms.canCreateInvoice).toBe(true);
      expect(perms.canViewCreditNotes).toBe(true);
      expect(perms.canViewServices).toBe(true);
      expect(perms.canManageServices).toBe(true);
      expect(perms.canResetPassword).toBe(true);
      expect(perms.canDeactivateUser).toBe(true);
    });

    it('restricts operator (user) to read-only on repository/settings and blocks users/audit', () => {
      const perms = getPermissionsForRole('user');
      expect(perms).toEqual(USER_PERMISSIONS);
      // Allowed views & operations
      expect(perms.canViewDashboard).toBe(true);
      expect(perms.canViewCustomers).toBe(true);
      expect(perms.canViewServices).toBe(true);
      expect(perms.canViewSettings).toBe(true);
      expect(perms.canViewQuotes).toBe(true);
      expect(perms.canCreateQuote).toBe(true);
      expect(perms.canViewInvoices).toBe(true);
      expect(perms.canCreateInvoice).toBe(true);
      expect(perms.canViewCreditNotes).toBe(true);

      // Strictly forbidden for Operator
      expect(perms.canViewUsers).toBe(false);
      expect(perms.canManageUsers).toBe(false);
      expect(perms.canViewAuditLog).toBe(false);
      expect(perms.canManageCustomers).toBe(false);
      expect(perms.canManageServices).toBe(false);
      expect(perms.canManageSettings).toBe(false);
      expect(perms.canResetPassword).toBe(false);
      expect(perms.canDeactivateUser).toBe(false);
    });

    it('aligns sidebar navigation items with role permissions for admin and operator', () => {
      const adminNavIds = navItems
        .filter((item) => item.roles.includes('admin'))
        .map((item) => item.id);
      const userNavIds = navItems
        .filter((item) => item.roles.includes('user'))
        .map((item) => item.id);

      expect(adminNavIds).toEqual([
        'dashboard',
        'users',
        'audit',
        'clients',
        'services',
        'quotes',
        'invoices',
        'credit-notes',
        'settings',
      ]);

      expect(userNavIds).toEqual([
        'dashboard',
        'clients',
        'services',
        'quotes',
        'invoices',
        'credit-notes',
        'settings',
      ]);
      expect(userNavIds).not.toContain('users');
      expect(userNavIds).not.toContain('audit');
    });
  });

  describe('2. Mandatory Password Change (force_password_change)', () => {
    it('persists force_password_change = 1 when creating a new user in UserRepository', () => {
      UserRepository.create({
        id: 'user-temp-pwd-1',
        name: 'Opérateur Test',
        email: 'operateur@gabon.ga',
        username: 'operateur@gabon.ga',
        password: 'hashed_temp_password',
        role: 'user',
        is_active: 1,
        force_password_change: 1,
        tenant_id: 'tenant-1',
      });

      const created = UserRepository.findById('user-temp-pwd-1');
      expect(created).toBeDefined();
      expect(created?.force_password_change).toBe(1);
    });

    it('clears force_password_change when password is updated', () => {
      UserRepository.create({
        id: 'user-temp-pwd-2',
        name: 'Admin Secondaire',
        email: 'admin2@gabon.ga',
        username: 'admin2@gabon.ga',
        password: 'hashed_temp_password',
        role: 'admin',
        is_active: 1,
        force_password_change: 1,
        tenant_id: 'tenant-1',
      });

      UserRepository.update('user-temp-pwd-2', {
        password: 'hashed_new_personal_password',
        force_password_change: 0,
      });

      const updated = UserRepository.findById('user-temp-pwd-2');
      expect(updated?.force_password_change).toBe(0);
      expect(updated?.password).toBe('hashed_new_personal_password');
    });

    it('validates password complexity in changePasswordSchema', () => {
      expect(
        changePasswordSchema.safeParse({ newPassword: 'short' }).success
      ).toBe(false);
      expect(
        changePasswordSchema.safeParse({ newPassword: 'alllowercase123' }).success
      ).toBe(false);
      expect(
        changePasswordSchema.safeParse({ newPassword: 'NoDigitsPassword' }).success
      ).toBe(false);
      expect(
        changePasswordSchema.safeParse({ newPassword: 'ValidPassword2026' }).success
      ).toBe(true);
    });
  });
});
