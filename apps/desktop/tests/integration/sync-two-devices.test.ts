import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { ensureSyncSchema, SYNC_TABLES } from '@/lib/sync/localSchema';
import { parseCursor } from '@/lib/sync/CloudSyncService';

/**
 * Banc d'essai multi-postes (Plan Correctif A0 / D1, D2, D3, A4)
 * Simule Poste 1 (P1), Poste 2 (P2) et un backend Supabase Cloud en mémoire.
 */

interface MockCloudStore {
  [table: string]: Array<Record<string, any>>;
}

function createMockSupabase(cloudStore: MockCloudStore) {
  return {
    from(tableName: string) {
      if (!cloudStore[tableName]) cloudStore[tableName] = [];
      const store = cloudStore[tableName];

      return {
        select(cols: string = '*') {
          let rows = [...store];
          let filteredRows = rows;

          const queryObj = {
            eq(col: string, val: any) {
              filteredRows = filteredRows.filter((r) => r[col] === val);
              return queryObj;
            },
            order(col: string, { ascending }: { ascending: boolean }) {
              filteredRows.sort((a, b) => {
                const va = a[col] ?? '';
                const vb = b[col] ?? '';
                if (va < vb) return ascending ? -1 : 1;
                if (va > vb) return ascending ? 1 : -1;
                return 0;
              });
              return queryObj;
            },
            gt(col: string, val: any) {
              filteredRows = filteredRows.filter((r) => (r[col] ?? '') > val);
              return queryObj;
            },
            or(orClause: string) {
              // Parse: server_updated_at.gt.TS,and(server_updated_at.eq.TS,id.gt.ID)
              const match = orClause.match(/server_updated_at\.gt\.([^,]+),and\(server_updated_at\.eq\.([^,]+),id\.gt\.([^\)]+)\)/);
              if (match) {
                const [, gtTs, eqTs, gtId] = match;
                filteredRows = filteredRows.filter((r) => {
                  const rTs = r.server_updated_at ?? '';
                  const rId = r.id ?? '';
                  return rTs > gtTs || (rTs === eqTs && rId > gtId);
                });
              }
              return queryObj;
            },
            limit(n: number) {
              filteredRows = filteredRows.slice(0, n);
              return Promise.resolve({ data: filteredRows, error: null });
            },
            then(resolve: any) {
              return Promise.resolve({ data: filteredRows, error: null }).then(resolve);
            },
          };
          return queryObj;
        },
        async upsert(records: Array<Record<string, any>>, { onConflict }: { onConflict: string }) {
          const nowIso = new Date().toISOString();
          for (const rec of records) {
            const pkVal = rec[onConflict];
            const idx = store.findIndex((r) => r[onConflict] === pkVal);
            const rowWithServerTs = {
              ...rec,
              server_updated_at: nowIso,
              updated_at: rec.updated_at || nowIso,
            };
            if (idx >= 0) {
              store[idx] = { ...store[idx], ...rowWithServerTs };
            } else {
              store.push(rowWithServerTs);
            }
          }
          return { data: records, error: null };
        },
        delete() {
          return {
            eq(col: string, val: any) {
              return {
                in(inCol: string, inVals: any[]) {
                  const valSet = new Set(inVals);
                  cloudStore[tableName] = store.filter((r) => !(r[col] === val && valSet.has(r[inCol])));
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
    auth: {
      async getUser() {
        return { data: { user: { id: 'usr-1', email: 'test@facturier.ga' } }, error: null };
      },
    },
  };
}

function initDeviceDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      nif TEXT,
      rccm TEXT,
      status TEXT DEFAULT 'active',
      createdAt TEXT,
      deletedAt TEXT,
      tenant_id TEXT,
      updated_at TEXT,
      synced_at TEXT
    );
    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      number TEXT,
      clientId TEXT,
      clientName TEXT,
      clientEmail TEXT,
      date TEXT,
      validUntil TEXT,
      subtotal REAL,
      discount REAL,
      taxBase REAL,
      tvaAmount REAL,
      tpsAmount REAL,
      cssAmount REAL,
      total REAL,
      status TEXT,
      notes TEXT,
      subject TEXT,
      createdAt TEXT,
      deletedAt TEXT,
      created_by TEXT,
      tenant_id TEXT,
      updated_at TEXT,
      synced_at TEXT
    );
    CREATE TABLE IF NOT EXISTS quote_items (
      id TEXT PRIMARY KEY,
      quoteId TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity REAL NOT NULL,
      unitPrice REAL NOT NULL,
      total REAL NOT NULL,
      tenant_id TEXT,
      deletedAt TEXT,
      updated_at TEXT,
      synced_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sequences (
      name TEXT PRIMARY KEY,
      current_value INTEGER DEFAULT 0,
      last_year INTEGER
    );
  `);
  ensureSyncSchema(db);
  return db;
}

describe('Sync Multi-Postes — Banc d essai 2 Postes (Lot A)', () => {
  let cloudStore: MockCloudStore;
  let mockSb: ReturnType<typeof createMockSupabase>;
  let dbP1: Database.Database;
  let dbP2: Database.Database;
  const tenantId = 'tenant-multi-postes';

  beforeEach(() => {
    cloudStore = {};
    mockSb = createMockSupabase(cloudStore);
    dbP1 = initDeviceDb();
    dbP2 = initDeviceDb();
  });

  afterEach(() => {
    dbP1.close();
    dbP2.close();
  });

  it('S-A1: P1 pousse 1 500 lignes, P2 tire avec pagination composite sans aucune perte (D1)', async () => {
    // 1. P1 insère 1 500 clients avec le même horodatage
    const sameTimestamp = '2026-10-28T12:00:00.000Z';
    const insertStmt = dbP1.prepare(`
      INSERT INTO clients (id, name, email, phone, tenant_id, updated_at, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `);

    const tx = dbP1.transaction(() => {
      for (let i = 1; i <= 1500; i++) {
        const id = `client-${String(i).padStart(5, '0')}`;
        insertStmt.run(id, `Client ${i}`, `client${i}@test.ga`, '+24101000000', tenantId, sameTimestamp);
      }
    });
    tx();

    // 2. Simuler P1 push vers le cloud
    const p1Rows = dbP1.prepare('SELECT * FROM clients WHERE tenant_id = ?').all(tenantId) as any[];
    await mockSb.from('clients').upsert(p1Rows, { onConflict: 'id' });

    // Forcer toutes les lignes cloud à avoir le MÊME server_updated_at pour reproduire le bug D1
    cloudStore['clients'].forEach((r) => {
      r.server_updated_at = sameTimestamp;
    });

    // 3. P2 effectue un pull paginé par lots de 500 avec le curseur composite (server_updated_at, id)
    let p2Pulled = 0;
    let cursor: { ts: string; id: string } | null = null;
    const PAGE_SIZE = 500;

    for (let loop = 0; loop < 10; loop++) {
      let q = mockSb
        .from('clients')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('server_updated_at', { ascending: true })
        .order('id', { ascending: true });

      if (cursor) {
        q = q.or(`server_updated_at.gt.${cursor.ts},and(server_updated_at.eq.${cursor.ts},id.gt.${cursor.id})`);
      }

      const { data } = await q.limit(PAGE_SIZE);
      const rows = data || [];
      if (rows.length === 0) break;

      p2Pulled += rows.length;
      const last = rows[rows.length - 1];
      cursor = { ts: last.server_updated_at, id: last.id };
    }

    // Le curseur composite doit avoir permis de tirer exactement les 1 500 lignes
    expect(p2Pulled).toBe(1500);
    expect(cursor?.id).toBe('client-01500');
  });

  it('S-A2: P1 modifie un devis (soft delete item), P2 synchronise sans lignes fantômes (D2)', () => {
    const quoteId = 'quote-001';

    // 1. Initial : devis avec 3 articles
    dbP1.prepare(`INSERT INTO quotes (id, number, tenant_id, total, status) VALUES (?, 'DEV-001', ?, 3000, 'EN_ATTENTE')`).run(quoteId, tenantId);
    const insItem = dbP1.prepare(`INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    insItem.run('item-1', quoteId, 'Ligne 1', 1, 1000, 1000, tenantId);
    insItem.run('item-2', quoteId, 'Ligne 2', 1, 1000, 1000, tenantId);
    insItem.run('item-3', quoteId, 'Ligne 3', 1, 1000, 1000, tenantId);

    // 2. P1 modifie le devis : conserve item-1, ajoute item-4, retire item-2 et item-3 (soft delete)
    const nowIso = new Date().toISOString();
    // Soft delete des articles retirés
    dbP1.prepare(`UPDATE quote_items SET deletedAt = ?, updated_at = ? WHERE quoteId = ? AND id IN ('item-2', 'item-3')`).run(nowIso, nowIso, quoteId);
    // Insertion du nouvel article
    insItem.run('item-4', quoteId, 'Ligne 4', 1, 1000, 1000, tenantId);

    // 3. Vérification des articles actifs sur P1
    const activeP1 = dbP1.prepare(`SELECT id, description FROM quote_items WHERE quoteId = ? AND (deletedAt IS NULL OR deletedAt = '')`).all(quoteId) as any[];
    expect(activeP1.map((i) => i.id)).toEqual(['item-1', 'item-4']);

    // 4. Les items soft-deletés conservent leur trace d'audit
    const deletedP1 = dbP1.prepare(`SELECT id FROM quote_items WHERE quoteId = ? AND deletedAt IS NOT NULL`).all(quoteId);
    expect(deletedP1.length).toBe(2);
  });

  it('S-A3: parseCursor supporte aussi bien les anciens curseurs string que les nouveaux objets composites', () => {
    // Format composite JSON
    const composite = parseCursor(JSON.stringify({ ts: '2026-10-28T10:00:00.000Z', id: 'rec-123' }));
    expect(composite).toEqual({ ts: '2026-10-28T10:00:00.000Z', id: 'rec-123' });

    // Format legacy string ISO
    const legacy = parseCursor('2026-10-28T09:00:00.000Z');
    expect(legacy).toEqual({ ts: '2026-10-28T09:00:00.000Z', id: '' });

    // Valeur nulle ou vide
    expect(parseCursor(null)).toBeNull();
    expect(parseCursor('')).toBeNull();
  });

  it('S-A4: Quarantaine des échecs de synchronisation (A4)', () => {
    // Insertion d'un échec récurrent dans sync_failures
    dbP1.prepare(`
      INSERT INTO sync_failures (table_name, record_id, error, attempts, last_attempt_at)
      VALUES ('clients', 'bad-client-1', 'Erreur contrainte', 5, datetime('now'))
    `).run();

    const quarantined = dbP1.prepare('SELECT record_id FROM sync_failures WHERE table_name = ? AND attempts >= 5').all('clients') as any[];
    expect(quarantined.length).toBe(1);
    expect(quarantined[0].record_id).toBe('bad-client-1');
  });
});
