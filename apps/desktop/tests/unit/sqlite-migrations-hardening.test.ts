import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, ALL_MIGRATIONS } from '@/lib/db/migrations';
import { buildTenantFilter } from '@/lib/api/tenant';

describe('Lot I — Cadre de migrations versionnées et durcissement SQLite (ADR-0040)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
  });

  it('I1.1 Déroule les migrations de 0 à la dernière version et met à jour user_version', () => {
    const initialVersion = Number(db.pragma('user_version', { simple: true }));
    expect(initialVersion).toBe(0);

    const report = runMigrations(db);
    expect(report.initialVersion).toBe(0);
    expect(report.finalVersion).toBe(ALL_MIGRATIONS[ALL_MIGRATIONS.length - 1].version);
    expect(report.appliedCount).toBe(ALL_MIGRATIONS.length);

    const updatedVersion = Number(db.pragma('user_version', { simple: true }));
    expect(updatedVersion).toBe(report.finalVersion);
  });

  it('I1.2 Est strictement idempotent : une seconde exécution n applique aucune migration supplémentaire', () => {
    runMigrations(db);
    const secondReport = runMigrations(db);
    expect(secondReport.appliedCount).toBe(0);
  });

  it('I2.1 Les montants sont contraints en entiers positifs (CHECK >= 0)', () => {
    runMigrations(db);

    const tenantId = '00000000-0000-4000-a000-000000000001';

    // Insertion d'un client
    db.prepare(`
      INSERT INTO clients (id, name, status, tenant_id)
      VALUES ('cli-test-1', 'Client Test', 'active', ?)
    `).run(tenantId);

    // Insertion d'une facture valide avec entiers
    db.prepare(`
      INSERT INTO invoices (id, number, clientId, date, subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total, status, tenant_id)
      VALUES ('inv-1', 'FAC-001', 'cli-test-1', '2026-10-28', 10000, 0, 10000, 950, 1800, 100, 11850, 'UNPAID', ?)
    `).run(tenantId);

    const inv = db.prepare('SELECT total, subtotal FROM invoices WHERE id = ?').get('inv-1') as { total: number; subtotal: number };
    expect(inv.total).toBe(11850);
    expect(inv.subtotal).toBe(10000);

    // Tentative d'insertion d'un montant négatif -> doit échouer (CHECK constraint)
    expect(() => {
      db.prepare(`
        INSERT INTO invoices (id, number, clientId, date, total, status, tenant_id)
        VALUES ('inv-neg', 'FAC-NEG', 'cli-test-1', '2026-10-28', -500, 'UNPAID', ?)
      `).run(tenantId);
    }).toThrow();
  });

  it('I2.2 Les statuts de factures sont contraints par CHECK (status IN (...))', () => {
    runMigrations(db);
    const tenantId = '00000000-0000-4000-a000-000000000001';

    db.prepare(`
      INSERT INTO clients (id, name, status, tenant_id)
      VALUES ('cli-test-2', 'Client Test 2', 'active', ?)
    `).run(tenantId);

    // Statut invalide -> doit échouer
    expect(() => {
      db.prepare(`
        INSERT INTO invoices (id, number, clientId, date, total, status, tenant_id)
        VALUES ('inv-bad-status', 'FAC-BAD', 'cli-test-2', '2026-10-28', 5000, 'INVALID_STATUS_XYZ', ?)
      `).run(tenantId);
    }).toThrow();
  });

  it('I2.3 tenant_id est obligatoire (NOT NULL) sur toutes les tables métier', () => {
    runMigrations(db);

    // Tentative d'insertion d'un client sans tenant_id -> doit échouer
    expect(() => {
      db.prepare(`
        INSERT INTO clients (id, name, status, tenant_id)
        VALUES ('cli-no-tenant', 'Client Sans Tenant', 'active', NULL)
      `).run();
    }).toThrow();
  });

  it('I2.4 buildTenantFilter applique un filtrage strict sans tolérance NULL', () => {
    const filter = buildTenantFilter('tenant-alpha', 'i');
    expect(filter.sql).toBe(' AND i.tenant_id = ?');
    expect(filter.params).toEqual(['tenant-alpha']);
    expect(filter.sql).not.toContain('IS NULL');
  });

  it('I2.5 Migration 0002 préserve les totaux de contrôle lors de la reconstruction de table', () => {
    // Étape 1 : base en v1 avec des montants flottants
    ALL_MIGRATIONS[0].up(db);
    db.pragma('user_version = 1');

    db.prepare(`
      INSERT INTO clients (id, name, tenant_id)
      VALUES ('cli-v1', 'Client V1', '00000000-0000-4000-a000-000000000001')
    `).run();

    db.prepare(`
      INSERT INTO invoices (id, number, clientId, date, subtotal, total, status, tenant_id)
      VALUES ('inv-v1-1', 'FAC-V1-1', 'cli-v1', '2026-10-28', 10000.4, 11850.4, 'UNPAID', '00000000-0000-4000-a000-000000000001'),
             ('inv-v1-2', 'FAC-V1-2', 'cli-v1', '2026-10-28', 20000.2, 23700.2, 'PAID', '00000000-0000-4000-a000-000000000001')
    `).run();

    // Application de la migration 0002 et suivantes
    const report = runMigrations(db);
    expect(report.finalVersion).toBe(ALL_MIGRATIONS[ALL_MIGRATIONS.length - 1].version);

    const sum = db.prepare('SELECT SUM(total) as s FROM invoices').get() as { s: number };
    // 11850 + 23700 = 35550
    expect(sum.s).toBe(35550);
  });

  it('I2.6 Migration 0002 rattrape les colonnes manquantes (ex: qi.deletedAt) sur une base legacy déjà en user_version=1', () => {
    // Simulation d'une base SQLite créée avant l'ajout de deletedAt/tenant_id sur *_items
    db.exec(`
      CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK (id = 1), companyName TEXT);
      CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin');
      CREATE TABLE clients (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE services (id TEXT PRIMARY KEY, name TEXT NOT NULL, unitPrice REAL DEFAULT 0);
      CREATE TABLE quotes (id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, clientId TEXT NOT NULL, date TEXT NOT NULL, total REAL DEFAULT 0);
      CREATE TABLE quote_items (id TEXT PRIMARY KEY, quoteId TEXT NOT NULL, description TEXT NOT NULL, quantity REAL NOT NULL, unitPrice REAL NOT NULL, total REAL NOT NULL);
      CREATE TABLE invoices (id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, clientId TEXT NOT NULL, date TEXT NOT NULL, total REAL DEFAULT 0);
      CREATE TABLE invoice_items (id TEXT PRIMARY KEY, invoiceId TEXT NOT NULL, description TEXT NOT NULL, quantity REAL NOT NULL, unitPrice REAL NOT NULL, total REAL NOT NULL);
      CREATE TABLE payments (id TEXT PRIMARY KEY, invoiceId TEXT NOT NULL, amount REAL NOT NULL, paymentMethod TEXT NOT NULL, date TEXT NOT NULL);
      CREATE TABLE credit_notes (id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, invoiceId TEXT NOT NULL, clientId TEXT NOT NULL, date TEXT NOT NULL, total REAL DEFAULT 0);
      CREATE TABLE credit_note_items (id TEXT PRIMARY KEY, creditNoteId TEXT NOT NULL, description TEXT NOT NULL, quantity REAL NOT NULL, unitPrice REAL NOT NULL, total REAL NOT NULL);
      CREATE TABLE audit_logs (id TEXT PRIMARY KEY, action TEXT NOT NULL, entityType TEXT NOT NULL);
    `);

    // La migration v1 a été marquée appliquée alors que CREATE TABLE IF NOT EXISTS n'a pas ajouté qi.deletedAt
    db.pragma('user_version = 1');

    db.prepare("INSERT INTO clients (id, name) VALUES ('cli-leg', 'Client Legacy')").run();
    db.prepare("INSERT INTO quotes (id, number, clientId, date, total) VALUES ('q-leg', 'DEV-LEG-1', 'cli-leg', '2026-10-28', 15000)").run();
    db.prepare("INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total) VALUES ('qi-leg', 'q-leg', 'Prestation', 1, 15000, 15000)").run();

    const report = runMigrations(db);
    expect(report.finalVersion).toBe(ALL_MIGRATIONS[ALL_MIGRATIONS.length - 1].version);

    const item = db.prepare('SELECT id, deletedAt, tenant_id, total FROM quote_items WHERE id = ?').get('qi-leg') as {
      id: string;
      deletedAt: string | null;
      tenant_id: string;
      total: number;
    };
    expect(item.id).toBe('qi-leg');
    expect(item.deletedAt).toBeNull();
    expect(item.tenant_id).toBeTruthy();
    expect(item.total).toBe(15000);
  });
});
