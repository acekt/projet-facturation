import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InvoiceService, resolveValidLocalUserId, resolveValidServiceId } from '@/lib/services/InvoiceService';
import { createTestDatabase, cleanupTestDatabase, seedTestData } from '../helpers/db';
import Database from 'better-sqlite3';

vi.mock('@/lib/db', async () => {
  const actualDb = await import('../helpers/db');
  return {
    default: actualDb.getTestDatabase(),
  };
});

describe('Remédiation Intégrité Clés Étrangères (FK) & Services Invalides', () => {
  let testDb: Database.Database;

  beforeEach(() => {
    testDb = createTestDatabase();
    seedTestData(testDb);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDatabase();
    vi.restoreAllMocks();
  });

  it('resolveValidLocalUserId résout les utilisateurs locaux et replie vers l administrateur local pour les ID externes Supabase', () => {
    testDb.prepare(`INSERT OR IGNORE INTO users (id, username, email, password, name, role, is_active, force_password_change, created_at, tenant_id) VALUES ('admin-user', 'admin_test', 'ad@test.com', 'hash', 'Admin Test', 'admin', 1, 0, '2026-01-01', '00000000-0000-4000-a000-000000000001')`).run();

    // 1. Utilisateur existant
    const validId = resolveValidLocalUserId(testDb, 'admin-user');
    expect(validId).toBe('admin-user');

    // 2. ID Supabase externe inconnu dans le SQLite local
    const externalSupabaseId = 'supabase-uuid-999-not-in-sqlite';
    const fallbackId = resolveValidLocalUserId(testDb, externalSupabaseId);
    expect(fallbackId).toBeDefined();
    expect(typeof fallbackId).toBe('string');

    // 3. Sans utilisateur
    const nullId = resolveValidLocalUserId(testDb, null);
    expect(nullId).toBeNull();
  });

  it('resolveValidServiceId retourne l ID réel si le service existe et null pour les timestamp ou services personnalisés', () => {
    testDb.prepare(`INSERT OR IGNORE INTO services (id, name, unitPrice, created_by, tenant_id) VALUES ('srv-1', 'Service Test', 15000, 'admin-user', '00000000-0000-4000-a000-000000000001')`).run();

    // 1. Service existant dans la base
    const valid = resolveValidServiceId(testDb, 'srv-1');
    expect(valid).toBe('srv-1');

    // 2. Timestamp ID généré côté client (ex: "1793911677000")
    const timestampId = resolveValidServiceId(testDb, '1793911677000');
    expect(timestampId).toBeNull();

    // 3. Chaîne vide ou inexistante
    expect(resolveValidServiceId(testDb, '')).toBeNull();
    expect(resolveValidServiceId(testDb, '   ')).toBeNull();
    expect(resolveValidServiceId(testDb, undefined)).toBeNull();
  });

  it('InvoiceService.createInvoice crée avec succès une facture même si serviceId est un timestamp ou ID inexistant', () => {
    const res = InvoiceService.createInvoice(
      {
        clientId: 'client-1',
        clientName: 'Client Test',
        clientEmail: 'test@client.com',
        date: '2026-11-05',
        discount: 0,
        applyTva: true,
        items: [
          {
            id: '1793911677000',
            serviceId: '1793911677000', // Timestamp temporaire généré par l'UI
            description: 'Prestation sur mesure sans catalogue',
            quantity: 2,
            unitPrice: 50000,
          },
        ],
      },
      'admin-user',
      'admin',
      '00000000-0000-4000-a000-000000000001'
    );

    expect(res).toBeDefined();
    expect(res.id).toBeDefined();
    expect(res.number).toMatch(/^FAC-/);

    // Vérifier l'insertion dans invoice_items : serviceId doit être null pour ne pas enfreindre la clé étrangère
    const item = testDb.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').get(res.id) as any;
    expect(item).toBeDefined();
    expect(item.serviceId).toBeNull();
    expect(item.description).toBe('Prestation sur mesure sans catalogue');
    expect(item.total).toBe(100000);
  });

  it('InvoiceService.createInvoice crée une facture Brouillon sans décrémenter le stock physique', () => {
    // Compter les mouvements de stock avant
    const initialMovements = testDb.prepare('SELECT COUNT(*) as cnt FROM stock_movements').get() as { cnt: number };

    const res = InvoiceService.createInvoice(
      {
        clientId: 'client-1',
        clientName: 'Client Test',
        date: '2026-11-05',
        status: 'DRAFT',
        discount: 0,
        items: [
          {
            serviceId: 'srv-1',
            description: 'Service catalogue',
            quantity: 5,
            unitPrice: 20000,
          },
        ],
      },
      'admin-user',
      'admin',
      '00000000-0000-4000-a000-000000000001'
    );

    expect(res).toBeDefined();
    const finalMovements = testDb.prepare('SELECT COUNT(*) as cnt FROM stock_movements').get() as { cnt: number };
    // Le stock ne doit pas être débité pour un brouillon
    expect(finalMovements.cnt).toBe(initialMovements.cnt);
  });
});
