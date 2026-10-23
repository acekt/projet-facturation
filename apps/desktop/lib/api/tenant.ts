import db from '@/lib/db';

const TENANT_TABLES = [
  'clients',
  'quotes',
  'quote_items',
  'invoices',
  'invoice_items',
  'payments',
  'services',
  'users',
  'credit_notes',
  'credit_note_items',
  'audit_logs',
] as const;

/**
 * Resolves the active tenant_id for a given userId or explicit session tenantId.
 * Falls back to reading the user's tenant_id in SQLite or the first admin's tenant_id.
 */
export function resolveActiveTenantId(
  userId?: string | null,
  explicitTenantId?: string | null
): string | null {
  if (explicitTenantId && explicitTenantId.trim() !== '') {
    return explicitTenantId.trim();
  }

  try {
    if (userId) {
      const userRow = db
        .prepare('SELECT tenant_id FROM users WHERE id = ?')
        .get(userId) as { tenant_id?: string | null } | undefined;
      if (userRow?.tenant_id && userRow.tenant_id.trim() !== '') {
        return userRow.tenant_id.trim();
      }
    }

    const adminRow = db
      .prepare(
        "SELECT tenant_id FROM users WHERE role = 'admin' AND tenant_id IS NOT NULL AND tenant_id != '' ORDER BY created_at ASC LIMIT 1"
      )
      .get() as { tenant_id?: string | null } | undefined;
    if (adminRow?.tenant_id && adminRow.tenant_id.trim() !== '') {
      return adminRow.tenant_id.trim();
    }
  } catch {
    // Ignore if table doesn't have tenant_id yet during early bootstrap
  }

  return null;
}

/**
 * Builds a SQLite WHERE fragment and parameter list that enforces strict multi-tenant
 * isolation when a tenant_id is active, while remaining compatible with legacy/seeded
 * test rows where tenant_id IS NULL.
 *
 * When a record belongs to ANOTHER non-null tenant_id, it is strictly excluded.
 */
export function buildTenantFilter(
  tenantId: string | null | undefined,
  tableAlias?: string
): { sql: string; params: string[] } {
  if (!tenantId) {
    return { sql: '', params: [] };
  }
  const col = tableAlias ? `${tableAlias}.tenant_id` : 'tenant_id';
  return {
    sql: ` AND (${col} = ? OR ${col} IS NULL OR ${col} = '')`,
    params: [tenantId],
  };
}

/**
 * Migrates all local rows from a pre-provisioning local tenant_id (or NULL/empty)
 * to the canonical Cloud tenant_id returned by Supabase.
 */
export function reconcileLocalTenantId(
  cloudTenantId: string,
  previousLocalTenantId?: string | null
): void {
  if (!cloudTenantId) return;

  const tx = db.transaction(() => {
    for (const table of TENANT_TABLES) {
      try {
        if (previousLocalTenantId && previousLocalTenantId !== cloudTenantId) {
          db.prepare(
            `UPDATE ${table} SET tenant_id = ? WHERE tenant_id = ? OR tenant_id IS NULL OR tenant_id = ''`
          ).run(cloudTenantId, previousLocalTenantId);
        } else {
          db.prepare(
            `UPDATE ${table} SET tenant_id = ? WHERE tenant_id IS NULL OR tenant_id = ''`
          ).run(cloudTenantId);
        }
      } catch {
        // Ignore if table not yet initialized
      }
    }
  });

  tx();
}
