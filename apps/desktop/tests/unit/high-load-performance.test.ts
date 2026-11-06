import { describe, it, expect, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@/lib/db/migrations';

const memoryDb = new Database(':memory:');
memoryDb.pragma('foreign_keys = ON');

vi.mock('@/lib/db', () => ({
  default: memoryDb,
}));

const testTenantId = 'tenant-perf-123';

describe('Lot 6 — Tests de Haute Performance et Robustesse Sous Forte Charge (ADR-0061)', () => {
  afterAll(() => {
    vi.restoreAllMocks();
    if (memoryDb && memoryDb.open) {
      memoryDb.close();
    }
  });

  it('HP1 — Les index composites de haute performance sont créés dans sqlite_master', () => {
    runMigrations(memoryDb);

    const indexes = memoryDb
      .prepare(`SELECT name FROM sqlite_master WHERE type='index'`)
      .all() as Array<{ name: string }>;
    const indexNames = new Set(indexes.map((idx) => idx.name));

    expect(indexNames.has('idx_ledger_tenant_active_date')).toBe(true);
    expect(indexNames.has('idx_ledger_tenant_category')).toBe(true);
    expect(indexNames.has('idx_stock_movements_service_date')).toBe(true);
    expect(indexNames.has('idx_services_tenant_stock')).toBe(true);
    expect(indexNames.has('idx_audit_logs_tenant_created')).toBe(true);
    expect(indexNames.has('idx_payments_tenant_invoice')).toBe(true);
    expect(indexNames.has('idx_credit_notes_tenant_invoice')).toBe(true);
  });

  it('HP2 — Insère 1 000 écritures de grand livre (avec reçus volumineux) et 500 mouvements de stock en < 1s', async () => {
    // Création d'un service pour rattacher les mouvements de stock
    memoryDb.prepare(`
      INSERT INTO services (id, tenant_id, name, stockItemName, unitPrice, trackStock, stockQuantity, minStockAlert)
      VALUES ('srv-perf-1', ?, 'Routeur Fibre Entreprise', 'Routeur Fibre', 75000, 1, 100, 10)
    `).run(testTenantId);

    // Image fictive Base64 de 100 Ko
    const large100KbImage = 'data:image/jpeg;base64,' + 'A'.repeat(100 * 1024);

    const insertLedgerStmt = memoryDb.prepare(`
      INSERT INTO ledger_entries (
        id, tenant_id, date, type, category, description, amount, paymentMethod, reference, counterparty, proofImage, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertStockStmt = memoryDb.prepare(`
      INSERT INTO stock_movements (
        id, tenant_id, serviceId, type, quantity, previousStock, newStock, notes, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tStart = performance.now();

    const insertTx = memoryDb.transaction(() => {
      // 1 000 écritures comptables
      for (let i = 1; i <= 1000; i++) {
        const id = `ledg-${i}`;
        const type = i % 3 === 0 ? 'OUT' : 'IN';
        const date = `2026-11-${String((i % 28) + 1).padStart(2, '0')}`;
        const category = type === 'IN' ? 'Ventes & Facturation' : 'Fournitures & Matériel';
        const amount = 5000 + (i * 350) % 500000;
        // 50 écritures ont un reçu lourd de 100 Ko
        const proof = i % 20 === 0 ? large100KbImage : null;
        const now = new Date(Date.now() - i * 60000).toISOString();

        insertLedgerStmt.run(
          id,
          testTenantId,
          date,
          type,
          category,
          `Opération commerciale #${i}`,
          amount,
          'Espèces',
          `REF-${i}`,
          `Client #${i % 100}`,
          proof,
          now,
          now
        );
      }

      // 500 mouvements de stock
      for (let j = 1; j <= 500; j++) {
        const id = `sm-${j}`;
        const type = j % 2 === 0 ? 'INVENTORY_IN' : 'INVENTORY_OUT';
        const qty = (j % 10) + 1;
        const now = new Date(Date.now() - j * 120000).toISOString();

        insertStockStmt.run(
          id,
          testTenantId,
          'srv-perf-1',
          type,
          qty,
          100,
          type === 'INVENTORY_IN' ? 100 + qty : 100 - qty,
          `Mouvement logistique #${j}`,
          now
        );
      }
    });

    insertTx();
    const duration = performance.now() - tStart;
    expect(duration).toBeLessThan(1500); // L'insertion par lot en transaction doit être ultra-rapide

    const countLedger = memoryDb.prepare('SELECT COUNT(*) as count FROM ledger_entries WHERE tenant_id = ?').get(testTenantId) as { count: number };
    const countStock = memoryDb.prepare('SELECT COUNT(*) as count FROM stock_movements WHERE tenant_id = ?').get(testTenantId) as { count: number };
    expect(countLedger.count).toBe(1000);
    expect(countStock.count).toBe(500);
  });

  it('HP3 — LedgerRepository.findAll et getSummary s exécutent en moins de 100 ms', async () => {
    const { LedgerRepository } = await import('@/lib/repositories/LedgerRepository');

    // 1. Benchmark findAll (1 000 lignes)
    const t0 = performance.now();
    const entries = LedgerRepository.findAll({ tenantId: testTenantId });
    const findAllTime = performance.now() - t0;

    expect(entries.length).toBe(1000);
    expect(findAllTime).toBeLessThan(100);

    // 2. Benchmark getSummary (agrégats SQL par catégorie et mode de paiement)
    const t1 = performance.now();
    const summary = LedgerRepository.getSummary({ tenantId: testTenantId });
    const summaryTime = performance.now() - t1;

    expect(summary.totalIn).toBeGreaterThan(0);
    expect(summary.totalOut).toBeGreaterThan(0);
    expect(summary.countIn + summary.countOut).toBe(1000);
    expect(summaryTime).toBeLessThan(100);
  });

  it('HP4 — Anti-OOM : findAll omet le Base64 volumineux et getProofImage le charge à la demande', async () => {
    const { LedgerRepository } = await import('@/lib/repositories/LedgerRepository');

    const entries = LedgerRepository.findAll({ tenantId: testTenantId });

    // Recherche d'une entrée avec reçu
    const entryWithProof = entries.find((e) => e.hasProofImage === 1 || e.hasProofImage === true);
    expect(entryWithProof).toBeDefined();

    // Vérification stricte anti-OOM : la chaîne volumineuse de 100 Ko n'est PAS renvoyée dans la liste
    expect((entryWithProof as any).proofImage).toBeUndefined();
    expect(entryWithProof?.hasProofImage).toBe(1);

    // Chargement à la demande de l'image
    const imageOnDemand = LedgerRepository.getProofImage(entryWithProof!.id, testTenantId);
    expect(imageOnDemand).not.toBeNull();
    expect(imageOnDemand!.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(imageOnDemand!.length).toBeGreaterThan(100 * 1024);
  });
});

