import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { LedgerRepository } from '@/lib/repositories/LedgerRepository';
import { MetricsRepository } from '@/lib/repositories/MetricsRepository';
import { getPaginatedAuditLogs, getAuditLogs } from '@/app/actions/audit.actions';
import db from '@/lib/db';


// We mock the session for actions
vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ userId: 'test-user', role: 'admin', tenantId: 'test-tenant' })
}));

describe('Scalability: High Load Benchmark', () => {
  beforeAll(async () => {
    // 1. Insert 2,000 invoices
    // 2. Insert 3,000 ledger_entries (50 with 150KB proofImage)
    // 3. Insert 1,000 stock movements (we'll just use services with trackStock for now)
    // 4. Insert 2,500 audit logs

    db.transaction(() => {
        // Clear first
        db.prepare('DELETE FROM invoices').run();
        db.prepare('DELETE FROM ledger_entries').run();
        db.prepare('DELETE FROM services').run();
        db.prepare('DELETE FROM audit_logs').run();
        db.prepare('DELETE FROM clients').run();

        db.prepare(`INSERT INTO clients (id, tenant_id, name) VALUES ('client-1', 'test-tenant', 'Client 1')`).run();

        // 2000 Invoices
        const insertInvoice = db.prepare(`INSERT INTO invoices (id, tenant_id, number, clientId, date, dueDate, status, subtotal, total, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for(let i=0; i<2000; i++) {
           insertInvoice.run(`inv-${i}`, 'test-tenant', `FAC-${i}`, 'client-1', '2023-01-01', '2023-01-15', 'PAID', 100, 100, '');
        }

        // 3000 Ledger Entries
        const insertLedger = db.prepare(`INSERT INTO ledger_entries (id, tenant_id, date, type, category, description, amount, paymentMethod, proofImage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for(let i=0; i<3000; i++) {
           const hasProof = i < 50;
           const proofImage = hasProof ? 'A'.repeat(150 * 1024) : null;
           insertLedger.run(`ledg-${i}`, 'test-tenant', '2023-01-01', i % 2 === 0 ? 'IN' : 'OUT', 'Ventes & Facturation', 'Desc', 50, 'Espèces', proofImage);
        }

        // 1000 stock items
        const insertStock = db.prepare(`INSERT INTO services (id, tenant_id, name, unitPrice, trackStock, stockQuantity, minStockAlert) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        for(let i=0; i<1000; i++) {
            insertStock.run(`stock-${i}`, 'test-tenant', `Service ${i}`, 10, 1, 100, 5);
        }

        // 2500 audit logs
        const insertAudit = db.prepare(`INSERT INTO audit_logs (id, userId, tenant_id, action, entityType, entityId, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        for(let i=0; i<2500; i++) {
            insertAudit.run(`audit-${i}`, 'test-user', 'test-tenant', 'CREATE', 'invoice', `inv-${i}`, '{}', '2023-01-01T12:00:00.000Z');
        }
    })();
  });

  afterAll(() => {
     db.transaction(() => {
        db.prepare('DELETE FROM invoices').run();
        db.prepare('DELETE FROM ledger_entries').run();
        db.prepare('DELETE FROM services').run();
        db.prepare('DELETE FROM audit_logs').run();
        db.prepare('DELETE FROM clients').run();
    })();
  });

  it('LedgerRepository.findAll and getSummary execute in < 120ms', () => {
     const startAll = performance.now();
     const entries = LedgerRepository.findAll({ tenantId: 'test-tenant' });
     const endAll = performance.now();
     expect(endAll - startAll).toBeLessThan(120);

     const startSummary = performance.now();
     const summary = LedgerRepository.getSummary({ tenantId: 'test-tenant' });
     const endSummary = performance.now();
     expect(endSummary - startSummary).toBeLessThan(120);

     // Check JSON doesn't include full proofImage
     expect(entries[0].proofImage).toBeUndefined();
  });

  it('MetricsRepository.getDashboardMetrics execute in < 200ms', () => {
      const periods = ['month', 'quarter', 'year'];
      for (const period of periods) {
          const start = performance.now();
          // We call the inner logic of getDashboardMetrics. It relies on multiple queries.
          const totalRevenue = MetricsRepository.getTotalRevenue('test-user', 'admin', '1=1', 'test-tenant');
          const summary = MetricsRepository.getLedgerSummary('test-user', 'admin', '1=1', 'test-tenant');
          const stock = MetricsRepository.getStockMetrics('test-user', 'admin', 'test-tenant');
          const end = performance.now();
          expect(end - start).toBeLessThan(200);
      }
  });

  it('getPaginatedAuditLogs and getAuditLogs execute in < 150ms', async () => {
      const startPaginated = performance.now();
      const resPaginated = await getPaginatedAuditLogs(1, 100, '', 'ALL', 'ALL', 'desc');
      const endPaginated = performance.now();
      expect(endPaginated - startPaginated).toBeLessThan(150);
      expect(resPaginated.success).toBe(true);

      const startAll = performance.now();
      const resAll = await getAuditLogs();
      const endAll = performance.now();
      expect(endAll - startAll).toBeLessThan(150);
      expect(resAll.success).toBe(true);
  });
});
