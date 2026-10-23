import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateFiscalCascade,
  computeTotals,
  formatDocNumber,
  DEFAULT_GABON_TAX_RATES,
} from '@workspace/database';
import {
  buildTenantFilter,
  resolveActiveTenantId,
  reconcileLocalTenantId,
} from '../../lib/api/tenant';
import { InvoiceRepository } from '../../lib/repositories/InvoiceRepository';
import { QuoteRepository } from '../../lib/repositories/QuoteRepository';
import { UserRepository } from '../../lib/repositories/UserRepository';
import { MetricsRepository } from '../../lib/repositories/MetricsRepository';
import { getTestDatabase, cleanupTestDatabase } from '../helpers/db';

describe('Phase 1 & 2 — Shared @workspace/database & Local Multi-Tenant Isolation', () => {
  beforeEach(() => {
    cleanupTestDatabase();
  });

  describe('@workspace/database — Gabonese DGI 2026 Fiscal Engine', () => {
    it('exports DEFAULT_GABON_TAX_RATES and calculates exact integer XAF cascade', () => {
      expect(DEFAULT_GABON_TAX_RATES).toEqual({
        tvaRate: 18,
        tpsRate: 9.5,
        cssRate: 1,
      });

      const cascade = calculateFiscalCascade(250000, 50000);
      // Net HT = 200,000 -> CSS (1%) = 2,000 -> TaxBase = 202,000
      // TPS (9.5%) = 19,190 -> TVA (18%) = 36,360 -> Total = 257,550
      expect(cascade).toMatchObject({
        subtotal: 250000,
        discount: 50000,
        netHt: 200000,
        cssAmount: 2000,
        taxBase: 202000,
        tpsAmount: 19190,
        tvaAmount: 36360,
        total: 257550,
      });
    });

    it('computes line item totals and formats Gabonese document numbers', () => {
      const totals = computeTotals(
        [
          { quantity: 2, unitPrice: 50000 },
          { quantity: 1, unitPrice: 100000 },
        ],
        0,
        DEFAULT_GABON_TAX_RATES
      );
      expect(totals.subtotal).toBe(200000);
      expect(totals.cssAmount).toBe(2000);
      expect(totals.taxBase).toBe(202000);
      expect(totals.tpsAmount).toBe(19190);
      expect(totals.tvaAmount).toBe(36360);
      expect(totals.total).toBe(257550);

      expect(formatDocNumber('FAC', 12, 'GM', 2026)).toBe('FAC-012/GM/2026');
    });
  });

  describe('Multi-Tenant Isolation (tenant_id) in SQLite Repositories', () => {
    it('strictly isolates invoices, quotes, users, and metrics between Tenant Alpha and Tenant Beta', () => {
      const db = getTestDatabase();

      // Seed Tenant Alpha & Tenant Beta users
      UserRepository.create({
        id: 'admin-alpha',
        name: 'Admin Alpha',
        email: 'alpha@empresa.ga',
        username: 'alpha@empresa.ga',
        password: 'hashed-password',
        role: 'admin',
        is_active: 1,
        tenant_id: 'tenant-alpha',
      });

      UserRepository.create({
        id: 'admin-beta',
        name: 'Admin Beta',
        email: 'beta@autre.ga',
        username: 'beta@autre.ga',
        password: 'hashed-password',
        role: 'admin',
        is_active: 1,
        tenant_id: 'tenant-beta',
      });

      // Seed Clients for both tenants
      db.prepare(
        `INSERT INTO clients (id, name, email, status, created_by, tenant_id) VALUES (?, ?, ?, 'active', ?, ?)`
      ).run('client-alpha', 'Client Alpha SARL', 'contact@alpha.ga', 'admin-alpha', 'tenant-alpha');

      db.prepare(
        `INSERT INTO clients (id, name, email, status, created_by, tenant_id) VALUES (?, ?, ?, 'active', ?, ?)`
      ).run('client-beta', 'Client Beta SA', 'contact@beta.ga', 'admin-beta', 'tenant-beta');

      // Seed Invoices for both tenants
      db.prepare(
        `INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total, status, created_by, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'UNPAID', ?, ?)`
      ).run(
        'inv-alpha-1',
        'FAC-001/ALPHA/2026',
        'client-alpha',
        'Client Alpha SARL',
        'contact@alpha.ga',
        '2026-10-01',
        '2026-10-31',
        100000,
        101000,
        9595,
        18180,
        1000,
        128775,
        'admin-alpha',
        'tenant-alpha'
      );

      db.prepare(
        `INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total, status, created_by, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'UNPAID', ?, ?)`
      ).run(
        'inv-beta-1',
        'FAC-001/BETA/2026',
        'client-beta',
        'Client Beta SA',
        'contact@beta.ga',
        '2026-10-01',
        '2026-10-31',
        500000,
        505000,
        47975,
        90900,
        5000,
        643875,
        'admin-beta',
        'tenant-beta'
      );

      // Seed Quotes for both tenants
      db.prepare(
        `INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total, status, created_by, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'EN_ATTENTE', ?, ?)`
      ).run(
        'quo-alpha-1',
        'DEV-001/ALPHA/2026',
        'client-alpha',
        'Client Alpha SARL',
        'contact@alpha.ga',
        '2026-10-01',
        100000,
        101000,
        9595,
        18180,
        1000,
        128775,
        'admin-alpha',
        'tenant-alpha'
      );

      db.prepare(
        `INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total, status, created_by, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'EN_ATTENTE', ?, ?)`
      ).run(
        'quo-beta-1',
        'DEV-001/BETA/2026',
        'client-beta',
        'Client Beta SA',
        'contact@beta.ga',
        '2026-10-01',
        500000,
        505000,
        47975,
        90900,
        5000,
        643875,
        'admin-beta',
        'tenant-beta'
      );

      // Verify InvoiceRepository isolation
      const alphaInvoices = InvoiceRepository.findAll('admin-alpha', 'admin', 'tenant-alpha');
      expect(alphaInvoices).toHaveLength(1);
      expect(alphaInvoices[0].id).toBe('inv-alpha-1');

      const betaInvoices = InvoiceRepository.findAll('admin-beta', 'admin', 'tenant-beta');
      expect(betaInvoices).toHaveLength(1);
      expect(betaInvoices[0].id).toBe('inv-beta-1');

      // Cross-tenant findById must return undefined
      expect(InvoiceRepository.findById('inv-beta-1', 'admin-alpha', 'admin', 'tenant-alpha')).toBeUndefined();

      // Verify QuoteRepository isolation
      const alphaQuotes = QuoteRepository.findAll('admin-alpha', 'admin', 'tenant-alpha');
      expect(alphaQuotes).toHaveLength(1);
      expect(alphaQuotes[0].id).toBe('quo-alpha-1');

      // Verify UserRepository isolation
      const alphaUsers = UserRepository.findAllActive('tenant-alpha');
      expect(alphaUsers).toHaveLength(1);
      expect(alphaUsers[0].id).toBe('admin-alpha');

      // Verify MetricsRepository isolation
      const alphaCounts = MetricsRepository.getInvoiceCounts('admin-alpha', 'admin', 'tenant-alpha');
      expect(alphaCounts.totalInvoicesCount).toBe(1);

      // Verify resolveActiveTenantId & reconcileLocalTenantId
      expect(resolveActiveTenantId('admin-alpha')).toBe('tenant-alpha');
      reconcileLocalTenantId('cloud-tenant-alpha-uuid', 'tenant-alpha');
      expect(resolveActiveTenantId('admin-alpha')).toBe('cloud-tenant-alpha-uuid');

      const tf = buildTenantFilter('cloud-tenant-alpha-uuid', 'i');
      expect(tf.sql).toContain('i.tenant_id = ?');
      expect(tf.params).toEqual(['cloud-tenant-alpha-uuid']);
    });
  });
});
