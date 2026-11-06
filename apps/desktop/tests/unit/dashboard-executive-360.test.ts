import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db';
import { MetricsRepository } from '@/lib/repositories/MetricsRepository';
import { getDashboardMetrics } from '@/app/actions/dashboard.actions';

describe('Tableau de Bord Exécutif 360° (Graphiques Croisés, Prévisions, Stock & Trésorerie)', () => {
  const tenantId = 'tenant-dash-test';
  const adminId = 'admin-dash-360';

  beforeEach(() => {
    // Nettoyage préalable
    db.prepare("DELETE FROM ledger_entries WHERE tenant_id = ?").run(tenantId);
    db.prepare("DELETE FROM stock_movements WHERE tenant_id = ?").run(tenantId);
    db.prepare("DELETE FROM services WHERE tenant_id = ?").run(tenantId);
    db.prepare("DELETE FROM payments WHERE tenant_id = ?").run(tenantId);
    db.prepare("DELETE FROM credit_notes WHERE tenant_id = ?").run(tenantId);
    db.prepare("DELETE FROM invoices WHERE tenant_id = ?").run(tenantId);
    db.prepare("DELETE FROM quotes WHERE tenant_id = ?").run(tenantId);
    db.prepare("DELETE FROM clients WHERE tenant_id = ?").run(tenantId);
    db.prepare("DELETE FROM users WHERE id = ?").run(adminId);

    // Création de l'utilisateur admin
    db.prepare(`
      INSERT INTO users (id, name, email, username, password, role, is_active, tenant_id)
      VALUES (?, 'Admin 360', 'admin360@test.ga', 'admin360', 'hash', 'admin', 1, ?)
    `).run(adminId, tenantId);
  });

  it('1. calcule correctement les indicateurs du Livre des Comptes (ledgerSummary)', () => {
    const today = new Date().toISOString().split('T')[0];

    // Insertion d'entrées et sorties dans le livre des comptes
    db.prepare(`
      INSERT INTO ledger_entries (id, tenant_id, date, type, category, description, amount, paymentMethod, created_by)
      VALUES 
        ('led-1', ?, ?, 'IN', 'Ventes', 'Encaissement client A', 500000, 'Virement Bancaire', ?),
        ('led-2', ?, ?, 'IN', 'Ventes', 'Encaissement client B', 300000, 'Airtel Money', ?),
        ('led-3', ?, ?, 'OUT', 'Loyer', 'Loyer bureaux', 250000, 'Virement Bancaire', ?),
        ('led-4', ?, ?, 'OUT', 'Fournitures', 'Papeterie', 50000, 'Espèces', ?)
    `).run(tenantId, today, adminId, tenantId, today, adminId, tenantId, today, adminId, tenantId, today, adminId);

    const summary = MetricsRepository.getLedgerSummary(adminId, 'admin', "date >= date('now', '-30 days')", tenantId);

    expect(summary.totalIn).toBe(800000);
    expect(summary.totalOut).toBe(300000);
    expect(summary.netTreasury).toBe(500000);
    expect(summary.averageMonthlyExpenses).toBe(100000); // 300000 / 3
  });

  it('2. calcule avec exactitude les métriques de stock (stockMetrics)', () => {
    // 3 articles suivis en stock : 1 normal, 1 sous seuil d'alerte, 1 en rupture
    db.prepare(`
      INSERT INTO services (id, tenant_id, name, stockItemName, unitPrice, trackStock, stockQuantity, minStockAlert, created_by)
      VALUES 
        ('srv-1', ?, 'Papier A4 80g', 'Rames Papier A4 Pro', 5000, 1, 50, 10, ?),
        ('srv-2', ?, 'Cartouche Encre Noire', 'Toner HP 85A', 45000, 1, 3, 5, ?),
        ('srv-3', ?, 'Clé USB 64Go', 'Flash Drive Kingston 64G', 12000, 1, 0, 5, ?),
        ('srv-4', ?, 'Service Conseil IT', NULL, 150000, 0, 0, 0, ?)
    `).run(tenantId, adminId, tenantId, adminId, tenantId, adminId, tenantId, adminId);

    const stockMetrics = MetricsRepository.getStockMetrics(adminId, 'admin', tenantId);

    expect(stockMetrics.trackedCount).toBe(3);
    expect(stockMetrics.lowStockCount).toBe(1); // srv-2 (3 <= 5 et > 0)
    expect(stockMetrics.outOfStockCount).toBe(1); // srv-3 (0 <= 0)
    // totalStockValue = (50 * 5000) + (3 * 45000) = 250000 + 135000 = 385000
    expect(stockMetrics.totalStockValue).toBe(385000);

    // Les articles sous surveillance doivent inclure en priorité la rupture et le stock faible
    expect(stockMetrics.lowStockItems.length).toBe(3);
    expect(stockMetrics.lowStockItems[0].id).toBe('srv-3'); // Rupture en 1er
    expect(stockMetrics.lowStockItems[1].id).toBe('srv-2'); // Alerte en 2nd
    expect(stockMetrics.lowStockItems[0].physicalTitle).toBe('Flash Drive Kingston 64G');
  });

  it('3. calcule les prévisions d encaissement à +30 jours nettes d avoirs et le pipeline devis pondéré', () => {
    const today = new Date().toISOString().split('T')[0];
    const dueDateIn15d = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    const dueDateIn45d = new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0];

    // Insertion des clients requis par la contrainte de clé étrangère
    db.prepare(`
      INSERT INTO clients (id, tenant_id, name, phone, created_by)
      VALUES 
        ('cli-1', ?, 'Client Alpha', '+24101000001', ?),
        ('cli-2', ?, 'Client Beta', '+24101000002', ?)
    `).run(tenantId, adminId, tenantId, adminId);

    // Facture 1 : échéance à +15 jours (dans la fenêtre de 30j), montant 400 000, acompte 100 000, avoir 50 000 => reste = 250 000
    db.prepare(`
      INSERT INTO invoices (id, tenant_id, number, clientId, clientName, date, dueDate, total, status, created_by)
      VALUES ('inv-f1', ?, 'FAC-2026-001', 'cli-1', 'Client Alpha', ?, ?, 400000, 'PARTIALLY_PAID', ?)
    `).run(tenantId, today, dueDateIn15d, adminId);

    db.prepare(`
      INSERT INTO payments (id, tenant_id, invoiceId, amount, paymentMethod, date, created_by)
      VALUES ('pay-f1', ?, 'inv-f1', 100000, 'Virement Bancaire', ?, ?)
    `).run(tenantId, today, adminId);

    db.prepare(`
      INSERT INTO credit_notes (id, tenant_id, invoiceId, clientId, number, reason, total, status, date, created_by)
      VALUES ('cn-f1', ?, 'inv-f1', 'cli-1', 'AV-2026-001', 'Remise', 50000, 'applied', ?, ?)
    `).run(tenantId, today, adminId);

    // Facture 2 : échéance à +45 jours (HORS fenêtre de 30j), montant 600 000
    db.prepare(`
      INSERT INTO invoices (id, tenant_id, number, clientId, clientName, date, dueDate, total, status, created_by)
      VALUES ('inv-f2', ?, 'FAC-2026-002', 'cli-2', 'Client Beta', ?, ?, 600000, 'UNPAID', ?)
    `).run(tenantId, today, dueDateIn45d, adminId);

    // Devis en attente : 1 actif de 2 000 000 TTC (subtotal 1 666 667 HT) et 1 expiré ou converti
    const validUntilFuture = new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0];
    db.prepare(`
      INSERT INTO quotes (id, tenant_id, number, clientId, clientName, date, validUntil, subtotal, total, status, created_by)
      VALUES 
        ('quo-1', ?, 'DEV-2026-001', 'cli-1', 'Client Alpha', ?, ?, 1666667, 2000000, 'ENVOYE', ?),
        ('quo-2', ?, 'DEV-2026-002', 'cli-2', 'Client Beta', ?, ?, 500000, 600000, 'CONVERTI', ?)
    `).run(tenantId, today, validUntilFuture, adminId, tenantId, today, validUntilFuture, adminId);

    const pipeline = MetricsRepository.getQuotesPipelineDetails(adminId, 'admin', tenantId);
    expect(pipeline.count).toBe(1);
    expect(pipeline.ttc).toBe(2000000);

    const netTreasury = 1000000;
    const averageMonthlyExpenses = 300000;
    const forecast = MetricsRepository.getForecastMetrics(
      adminId,
      'admin',
      netTreasury,
      averageMonthlyExpenses,
      100000, // totalPaidRevenue
      250000 + 600000, // pendingRevenue
      tenantId
    );

    // Inflows 30j attendus = reste net d'avoirs de inv-f1 = 400 000 - 100 000 - 50 000 = 250 000
    expect(forecast.expectedInflows30d).toBe(250000);
    // Pipeline devis pondéré à 35% = 2 000 000 * 0.35 = 700 000
    expect(forecast.weightedQuotesPipeline).toBe(700000);
    // Atterrissage net à +30j = 1 000 000 + 250 000 + 700 000 - 300 000 = 1 650 000
    expect(forecast.projectedNetCash30d).toBe(1650000);
    // Taux de conversion devis : 1 converti sur 2 devis non-brouillons = 50%
    expect(forecast.quoteConversionRate).toBe(50);
  });
});
