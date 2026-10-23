import db from '@/lib/db';
import { DbUser } from '@/lib/types/api';
import { buildTenantFilter, resolveActiveTenantId } from '@/lib/api/tenant';

export const UserRepository = {
  findAllActive(tenantId?: string | null): DbUser[] {
    const tf = buildTenantFilter(tenantId);
    return db
      .prepare(`SELECT * FROM users WHERE deletedAt IS NULL${tf.sql}`)
      .all(...tf.params) as DbUser[];
  },

  findByUsername(username: string): DbUser | undefined {
    return db
      .prepare('SELECT * FROM users WHERE (username = ? OR email = ?) AND deletedAt IS NULL')
      .get(username, username) as DbUser | undefined;
  },

  findById(id: string): DbUser | undefined {
    return db
      .prepare('SELECT * FROM users WHERE id = ? AND deletedAt IS NULL')
      .get(id) as DbUser | undefined;
  },

  create(user: Omit<DbUser, 'created_at' | 'last_login_at' | 'deletedAt'>): void {
    const tenantId = user.tenant_id ?? resolveActiveTenantId(user.created_by ?? null);
    const forcePasswordChange = user.force_password_change !== undefined ? (user.force_password_change ? 1 : 0) : 0;
    db.prepare(`
      INSERT INTO users (id, name, email, username, password, role, is_active, force_password_change, created_by, phone, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.name,
      user.email,
      user.username,
      user.password,
      user.role,
      user.is_active,
      forcePasswordChange,
      user.created_by ?? null,
      user.phone || null,
      tenantId
    );
  },

  update(id: string, updates: Partial<DbUser>): void {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });

    if (fields.length === 0) return;

    values.push(id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  },

  updateLastLogin(id: string): void {
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(id);
  },

  softDelete(id: string): void {
    db.prepare("UPDATE users SET deletedAt = datetime('now') WHERE id = ?").run(id);
  },

  checkEmailExists(email: string): boolean {
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND deletedAt IS NULL').get(email);
    return !!existing;
  },

  checkUsernameExists(username: string): boolean {
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND deletedAt IS NULL').get(username);
    return !!existing;
  }
};
