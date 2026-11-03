import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@/lib/db/migrations';
import fs from 'fs';
import path from 'path';

// Declare these outside so they can be hoisted
const memoryDb = new Database(':memory:');
memoryDb.pragma('foreign_keys = ON');

vi.mock('@/lib/db', () => {
  return { default: memoryDb };
});

const tenantId = 'test-tenant-id';
const userId = 'test-user-id';

vi.mock('@/lib/api/tenant', () => ({
  resolveActiveTenantId: () => tenantId,
  buildTenantFilter: () => ({ sql: ' AND tenant_id = ?', params: [tenantId] })
}));

describe('Stock Management Integration & UI Checks', () => {
  afterAll(() => {
    vi.restoreAllMocks();
    if (memoryDb && memoryDb.open) {
      memoryDb.close();
    }
  });

  it('S1.1 - SQLite logic: stock entry, deduction on invoice, restock on credit note', async () => {
    runMigrations(memoryDb);

    // Require services to use the mocked DB
    const { StockRepository } = await import('@/lib/repositories/StockRepository');

    memoryDb.prepare(`
      INSERT INTO services (id, name, unitPrice, trackStock, stockQuantity, minStockAlert, tenant_id)
      VALUES ('srv-1', 'Test Product', 1000, 1, 10, 5, ?)
    `).run(tenantId);

    const initialCatalog = StockRepository.getStockCatalog(userId, tenantId);
    expect(initialCatalog.length).toBe(1);
    expect((initialCatalog[0] as any).stockQuantity).toBe(10);

    // Stock entry
    const entryRes = StockRepository.recordStockMovement({
      serviceId: 'srv-1',
      type: 'INVENTORY_IN',
      quantity: 5
    }, userId, tenantId);

    expect(entryRes.success).toBe(true);
    expect(entryRes.newStock).toBe(15);

    const afterEntry = memoryDb.prepare('SELECT stockQuantity FROM services WHERE id = ?').get('srv-1') as any;
    expect(afterEntry.stockQuantity).toBe(15);

    // Deduction
    const deductRes = StockRepository.recordStockMovement({
      serviceId: 'srv-1',
      type: 'INVOICE_DEDUCTION',
      quantity: 2
    }, userId, tenantId);

    expect(deductRes.newStock).toBe(13);

    // Restock
    const restockRes = StockRepository.recordStockMovement({
      serviceId: 'srv-1',
      type: 'CREDIT_NOTE_RESTOCK',
      quantity: 1
    }, userId, tenantId);

    expect(restockRes.newStock).toBe(14);

    // Low stock alert trigger
    StockRepository.recordStockMovement({
      serviceId: 'srv-1',
      type: 'INVENTORY_OUT',
      quantity: 10
    }, userId, tenantId);

    const currentService = memoryDb.prepare('SELECT stockQuantity FROM services WHERE id = ?').get('srv-1') as any;
    expect(currentService.stockQuantity).toBe(4);

    const alerts = StockRepository.getLowStockAlerts(userId, tenantId);
    expect(alerts.length).toBe(1);
    expect((alerts[0] as any).id).toBe('srv-1');
  });

  it('S1.2 - UI/Logic files existence and basic structure checking', () => {
    const desktopPath = path.resolve(__dirname, '../../');

    const stockPagePath = path.join(desktopPath, 'components/pages/stock.tsx');
    const stockRepoPath = path.join(desktopPath, 'lib/repositories/StockRepository.ts');
    const stockActionsPath = path.join(desktopPath, 'app/actions/stock.actions.ts');
    const navigationPath = path.join(desktopPath, 'components/layout/navigation.tsx');
    const appShellPath = path.join(desktopPath, 'components/pages/protected-app-shell.tsx');
    const serviceFormPath = path.join(desktopPath, 'components/pages/services/ServiceFormDialog.tsx');

    // 1. Files existence
    expect(fs.existsSync(stockPagePath)).toBe(true);
    expect(fs.existsSync(stockRepoPath)).toBe(true);
    expect(fs.existsSync(stockActionsPath)).toBe(true);

    // 2. Content validations
    const navContent = fs.readFileSync(navigationPath, 'utf-8');
    expect(navContent).toContain('Gestion de stock');

    const appShellContent = fs.readFileSync(appShellPath, 'utf-8');
    expect(appShellContent).toContain('<StockPage />');

    const serviceFormContent = fs.readFileSync(serviceFormPath, 'utf-8');
    expect(serviceFormContent).toContain('trackStock');
  });
});
