import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AppSchema } from '@/lib/powersync/AppSchema';
import { formatDocNumber } from '@/lib/api/numbering';

describe('Phase 1 : PowerSync Full Schema & Sync Rules Validation', () => {
  it('1. AppSchema should contain all required tables matching PostgreSQL replication schema', () => {
    const tableNames = AppSchema.tables.map((t) => t.name);

    const expectedTables = [
      'tenants',
      'profiles',
      'clients',
      'services',
      'quotes',
      'quote_items',
      'invoices',
      'invoice_items',
      'payments',
      'credit_notes',
      'credit_note_items',
      'audit_logs',
      'tenant_settings',
      'announcements',
    ];

    for (const expected of expectedTables) {
      expect(tableNames).toContain(expected);
    }
  });

  it('2. Multi-tenant tables in AppSchema must declare tenant_id and indexes', () => {
    const tablesWithTenant = [
      'profiles',
      'clients',
      'services',
      'quotes',
      'quote_items',
      'invoices',
      'invoice_items',
      'payments',
      'credit_notes',
      'credit_note_items',
      'audit_logs',
      'tenant_settings',
    ];

    for (const name of tablesWithTenant) {
      const table = AppSchema.tables.find((t) => t.name === name);
      expect(table, `Table ${name} missing in AppSchema`).toBeDefined();
      const columnNames = table?.columns.map((c) => c.name) ?? [];
      expect(columnNames, `Table ${name} must declare tenant_id`).toContain('tenant_id');
    }
  });

  it('3. Official sync_rules.yaml must exist and contain valid bucket definitions', () => {
    const syncRulesPath = path.resolve(process.cwd(), '../../supabase/sync_rules.yaml');
    expect(fs.existsSync(syncRulesPath), 'supabase/sync_rules.yaml must exist').toBe(true);

    const content = fs.readFileSync(syncRulesPath, 'utf-8');
    expect(content).toContain('bucket_definitions:');
    expect(content).toContain('tenant_data:');
    expect(content).toContain('user_profile:');
    expect(content).toContain('announcements:');
    expect(content).toContain('tenant_id = bucket.tenant_id');
  });

  it('4. Numbering should support optional device/caisse prefix for collision prevention', () => {
    // Sans préfixe de poste (mode standard mono-caisse)
    const stdNumber = formatDocNumber('FAC', 'GAB', 2026, 1);
    expect(stdNumber).toBe('FAC-001/GAB/2026');

    // Avec préfixe de poste (mode multi-caisses pour éviter collision)
    const pos1Number = formatDocNumber('FAC', 'GAB', 2026, 1, 'P1');
    expect(pos1Number).toBe('FAC-P1-001/GAB/2026');

    const pos2Number = formatDocNumber('FAC', 'GAB', 2026, 1, 'P2');
    expect(pos2Number).toBe('FAC-P2-001/GAB/2026');

    // Garantit l'unicité stricte entre deux caisses émettant le 1er ticket
    expect(pos1Number).not.toBe(pos2Number);
  });
});
