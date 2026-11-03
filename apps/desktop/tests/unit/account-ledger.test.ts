import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import db from '@/lib/db';
import { runMigrations } from '@/lib/db/migrations';
import { LedgerRepository } from '@/lib/repositories/LedgerRepository';
import { createPayment } from '@/app/actions/payment.actions';

// Mock getSession to simulate an authenticated admin user
vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: 'user-admin',
    role: 'admin',
    tenantId: 'tenant-test',
    name: 'Admin User',
  }),
}));

describe('Account Ledger (Journal de Trésorerie) Module', () => {
  const tenantId = 'tenant-test';

  beforeEach(() => {
    // Clear and migrate the memory DB for testing
    // Using db.exec to drop all tables if we were using a file, but here we just need to re-migrate.
    // However, since we import a singleton `db` from '@/lib/db', we need to reset its state.

    // Ensure clean state. Due to foreign keys and some SQLite pragmas, we clear data instead of dropping tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    db.pragma('foreign_keys = OFF');
    for (const table of tables) {
      if (table.name !== 'sqlite_sequence' && table.name !== 'sync_tombstones') {
         db.exec(`DELETE FROM ${table.name}`);
      }
    }
    db.pragma('foreign_keys = ON');

    // Run migrations just in case memory db was empty
    runMigrations(db);

    // Seed necessary data for payment sync tests
    db.prepare(`
      INSERT INTO clients (id, name, status, tenant_id)
      VALUES ('client-1', 'Test Client', 'active', ?)
    `).run(tenantId);

    db.prepare(`
      INSERT INTO invoices (id, number, clientId, date, subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total, status, tenant_id)
      VALUES ('inv-1', 'FAC-001', 'client-1', '2026-11-01', 10000, 0, 10000, 0, 0, 0, 10000, 'UNPAID', ?)
    `).run(tenantId);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('L1. La migration, le repository et les actions sont physiquement présents', () => {
    const migrationPath = path.resolve(__dirname, '../../lib/db/migrations/0005_account_ledger.ts');
    const repoPath = path.resolve(__dirname, '../../lib/repositories/LedgerRepository.ts');
    const actionPath = path.resolve(__dirname, '../../app/actions/ledger.actions.ts');

    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(fs.existsSync(repoPath)).toBe(true);
    expect(fs.existsSync(actionPath)).toBe(true);
  });

  it('L2. Création manuelle d une Recette (IN) et d une Dépense (OUT)', () => {
    const recette = LedgerRepository.create({
      tenant_id: tenantId,
      date: '2026-11-05',
      type: 'IN',
      category: 'Ventes & Facturation',
      description: 'Vente comptoir',
      amount: 5000,
      paymentMethod: 'Espèces',
    });

    const depense = LedgerRepository.create({
      tenant_id: tenantId,
      date: '2026-11-10',
      type: 'OUT',
      category: 'Fournitures & Matériel',
      description: 'Achat papier',
      amount: 2500,
      paymentMethod: 'Carte Bancaire',
    });

    expect(recette.id).toBeDefined();
    expect(recette.amount).toBe(5000);
    expect(depense.id).toBeDefined();
    expect(depense.amount).toBe(2500);

    const entries = LedgerRepository.findAll({ tenantId });
    expect(entries.length).toBe(2);
  });

  it('L3. Le filtrage mensuel retourne les sorties, recettes et le solde net exact', () => {
    // Entries for Nov 2026
    LedgerRepository.create({ tenant_id: tenantId, date: '2026-11-01', type: 'IN', category: 'Ventes & Facturation', description: 'R1', amount: 10000, paymentMethod: 'Espèces' });
    LedgerRepository.create({ tenant_id: tenantId, date: '2026-11-15', type: 'OUT', category: 'Loyer & Charges', description: 'D1', amount: 3000, paymentMethod: 'Virement' });

    // Entry for Oct 2026 (should be excluded)
    LedgerRepository.create({ tenant_id: tenantId, date: '2026-10-31', type: 'IN', category: 'Ventes & Facturation', description: 'R2', amount: 5000, paymentMethod: 'Espèces' });

    const summary = LedgerRepository.getSummary({ tenantId, month: '2026-11' });

    expect(summary.countIn).toBe(1);
    expect(summary.countOut).toBe(1);
    expect(summary.totalIn).toBe(10000);
    expect(summary.totalOut).toBe(3000);
    expect(summary.netBalance).toBe(7000); // 10000 - 3000

    expect(summary.byCategory['Ventes & Facturation']).toBe(10000);
    expect(summary.byCategory['Loyer & Charges']).toBe(3000);
  });

  it('L4. Insertion automatique d une recette dans ledger_entries lors d un paiement de facture', async () => {
    const paymentData = {
      invoiceId: 'inv-1',
      amount: 4000,
      paymentMethod: 'Espèces',
      date: '2026-11-20',
      reference: 'REF-123'
    };

    const response = await createPayment(paymentData);
    expect(response.success).toBe(true);

    if (response.success && response.data) {
      const paymentId = response.data.id;

      const entries = LedgerRepository.findAll({ tenantId });
      expect(entries.length).toBe(1);

      const ledgerEntry = entries[0];
      expect(ledgerEntry.type).toBe('IN');
      expect(ledgerEntry.amount).toBe(4000);
      expect(ledgerEntry.linkedPaymentId).toBe(paymentId);
      expect(ledgerEntry.linkedInvoiceId).toBe('inv-1');
      expect(ledgerEntry.category).toBe('Ventes & Facturation');
      expect(ledgerEntry.counterparty).toBe('Test Client');
      expect(ledgerEntry.description).toContain('FAC-001');
    } else {
      throw new Error('createPayment failed unexpectedly');
    }
  });
});
