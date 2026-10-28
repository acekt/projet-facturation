import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import db from '@/lib/db';
import { reconcileLocalTenantId, resolveActiveTenantId } from '@/lib/api/tenant';
import { SYNC_TABLES, type SyncTableConfig } from './localSchema';
import { processPendingMembers } from './cloudMembers';
import { sendSyncTelemetry } from './TelemetryReporter';

/**
 * CloudSyncService — pont SQLite local (better-sqlite3) <-> Supabase.
 * ---------------------------------------------------------------------------
 *  - Local-first : SQLite reste la source de vérité de l'UI.
 *  - Push : lignes modifiées (updated_at > synced_at) + suppressions (tombstones).
 *  - Pull : lignes dont server_updated_at > curseur (par table et par tenant).
 *  - Conflits : Last-Write-Wins sur updated_at (ISO UTC) + résolution automatique
 *    des collisions de numérotation documentaire (23505 sur quotes/invoices/credit_notes).
 *  - Multi-tenant : tout est filtré par tenant_id (et protégé par RLS côté Supabase).
 * Exécuté uniquement côté serveur Next (Server Action) avec le JWT de l'utilisateur.
 */

const BATCH = 200;
const PULL_PAGE = 1000;
const NUMBERED_TABLES = new Set(['quotes', 'invoices', 'credit_notes']);

export interface SyncReport {
  tenantId: string;
  pushed: number;
  pulled: number;
  deleted: number;
  skipped: number;
  errors: string[];
}

const toSnake = (s: string) => s.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());

/** Normalise un horodatage SQLite ('YYYY-MM-DD HH:MM:SS') ou ISO en ISO UTC. */
function toIso(v: unknown): string | null {
  if (!v) return null;
  let s = String(v);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(' ', 'T') + 'Z';
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Configuration Supabase manquante (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).');
  return { url, anon };
}

function clientWithToken(accessToken: string): SupabaseClient {
  const { url, anon } = env();
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label}: délai dépassé`)), ms)),
  ]);
}

function localColumns(table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
}

function getMeta(key: string): string | null {
  const row = db.prepare('SELECT value FROM sync_meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}
function setMeta(key: string, value: string) {
  db.prepare('INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export interface CompositeCursor {
  ts: string;
  id: string;
}

export function parseCursor(raw: string | null): CompositeCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.ts === 'string') {
      return { ts: parsed.ts, id: String(parsed.id || '') };
    }
  } catch {
    // Format legacy (string ISO simple)
  }
  return { ts: raw, id: '' };
}

function recordSyncFailure(table: string, recordId: string, error: string) {
  try {
    db.prepare(`
      INSERT INTO sync_failures (table_name, record_id, error, attempts, last_attempt_at)
      VALUES (?, ?, ?, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT(table_name, record_id) DO UPDATE SET
        attempts = sync_failures.attempts + 1,
        error = excluded.error,
        last_attempt_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    `).run(table, recordId, String(error).slice(0, 500));
  } catch {
    // sync_failures table may not exist yet in test harness without ensureSyncSchema
  }
}

function clearSyncFailure(table: string, recordId: string) {
  try {
    db.prepare('DELETE FROM sync_failures WHERE table_name = ? AND record_id = ?').run(table, recordId);
  } catch {
    // Non bloquant
  }
}

function getQuarantinedIds(table: string): Set<string> {
  try {
    const rows = db.prepare('SELECT record_id FROM sync_failures WHERE table_name = ? AND attempts >= 5').all(table) as Array<{ record_id: string }>;
    return new Set(rows.map((r) => r.record_id));
  } catch {
    return new Set();
  }
}

/** Mesure la dérive de l'horloge locale par rapport au serveur Supabase via l'en-tête HTTP Date */
async function measureClockDrift(): Promise<number | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url) return null;
    const res = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: anon || '' },
    });
    const serverDate = res.headers.get('date');
    if (serverDate) {
      const serverTime = new Date(serverDate).getTime();
      const localTime = Date.now();
      const offsetMs = localTime - serverTime;
      setMeta('clock_offset_ms', String(offsetMs));
      return offsetMs;
    }
  } catch {
    // Non bloquant si hors ligne
  }
  return null;
}

/** Diagnostic tenant strict (Lot E2 / D11) */
function checkTenantIsolation(): { nullCount: number; affectedTables: string[] } {
  let nullCount = 0;
  const affectedTables: string[] = [];
  try {
    for (const cfg of SYNC_TABLES) {
      if (cfg.singleton) continue;
      const count = (db.prepare(`SELECT COUNT(*) as c FROM ${cfg.local} WHERE tenant_id IS NULL OR tenant_id = ''`).get() as { c: number })?.c || 0;
      if (count > 0) {
        nullCount += count;
        affectedTables.push(cfg.local);
      }
    }
    if (nullCount === 0) {
      setMeta('tenant_strict', '1');
    }
  } catch {
    // Tolérance
  }
  return { nullCount, affectedTables };
}

// ---------------------------------------------------------------------------
// Contexte : utilisateur, profil, tenant (avec provisioning si nécessaire)
// ---------------------------------------------------------------------------
async function resolveContext(sb: SupabaseClient, accessToken: string) {
  const { data: userData, error: userErr } = await sb.auth.getUser(accessToken);
  if (userErr || !userData.user) throw new Error('Session Supabase invalide ou expirée.');
  const user = userData.user;

  const readProfile = async () => {
    const { data, error } = await sb
      .from('profiles')
      .select('id, tenant_id, role')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw new Error(`Lecture du profil impossible : ${error.message}`);
    return data as { id: string; tenant_id: string | null; role: string | null } | null;
  };

  let profile = await readProfile();
  const role = (profile?.role || '').toLowerCase();
  if (role === 'superadmin' || role === 'super_admin') {
    throw new Error('Le Superadmin ne peut pas synchroniser le Desktop (réservé au Web Hub).');
  }

  const previousLocalTenantId = resolveActiveTenantId();

  if (!profile?.tenant_id) {
    // Premier lancement : le setup local n'a pas encore pu créer le tenant dans le Cloud.
    const settings = db.prepare('SELECT companyName FROM settings WHERE id = 1').get() as { companyName?: string } | undefined;
    const localUser = db
      .prepare('SELECT name, phone FROM users WHERE LOWER(email) = ? ORDER BY created_at ASC LIMIT 1')
      .get((user.email || '').toLowerCase()) as { name?: string; phone?: string } | undefined;

    const { error } = await sb.rpc('provision_tenant', {
      p_company_name: settings?.companyName || 'Mon entreprise',
      p_full_name: localUser?.name || (user.email || '').split('@')[0],
      p_phone: localUser?.phone || null,
    });
    if (error) throw new Error(`Provisioning du tenant impossible : ${error.message}`);
    profile = await readProfile();
  }

  if (!profile?.tenant_id) throw new Error('Aucun tenant associé à ce compte.');

  const cloudTenantId = String(profile.tenant_id);

  // Porte de licence et contrôle de suspension administrative
  const { data: tenantData } = await sb
    .from('tenants')
    .select('id, name, status, license_expires_at')
    .eq('id', cloudTenantId)
    .maybeSingle();

  if (tenantData) {
    try {
      const { updateCachedLicenseStatus } = await import('@/lib/api/license');
      updateCachedLicenseStatus(
        cloudTenantId,
        tenantData.status as any,
        tenantData.license_expires_at
      );
    } catch {
      // ignore
    }
  }

  if (tenantData?.status === 'suspended') {
    throw new Error(
      "Synchronisation suspendue : l'accès cloud de votre entreprise a été suspendu par l'administrateur du Hub."
    );
  }

  if (tenantData?.status === 'expired') {
    throw new Error(
      "Synchronisation interrompue : votre abonnement Facturier est expiré. Veuillez contacter le support pour renouveler votre licence."
    );
  }

  reconcileLocalTenantId(cloudTenantId, previousLocalTenantId);

  return { userId: user.id, tenantId: cloudTenantId, role: (profile.role || '').toLowerCase() };
}

/**
 * Résout une collision de numéro de document (code Postgres 23505 sur (tenant_id, number))
 * lorsque deux postes Desktop hors-ligne ont généré le même numéro séquentiel.
 */
/**
 * Résout une collision de numéro de document (23505) ou isole une ligne en échec
 * sans bloquer le reste de la table ou de la file.
 */
async function pushRowFallback(
  sb: SupabaseClient,
  cfg: SyncTableConfig,
  rows: Array<Record<string, unknown>>,
  payloads: Array<Record<string, unknown>>,
  markSynced: { run: (...params: unknown[]) => unknown },
  report: SyncReport
) {
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const itemPayload = { ...payloads[idx] };
    const rowId = String(row.id ?? '1');
    const { error } = await sb.from(cfg.remote).upsert([itemPayload], { onConflict: cfg.remotePk });

    if (!error) {
      if (cfg.singleton) markSynced.run(row.updated_at);
      else markSynced.run(row.id, row.updated_at);
      clearSyncFailure(cfg.local, rowId);
      report.pushed++;
      continue;
    }

    const isUniqueCollision =
      error.code === '23505' ||
      error.message?.toLowerCase().includes('duplicate key') ||
      error.message?.toLowerCase().includes('unique constraint');

    if (isUniqueCollision && NUMBERED_TABLES.has(cfg.local) && typeof row.number === 'string') {
      const suffix = String(row.id).replace(/-/g, '').slice(0, 4).toUpperCase();
      const disambiguatedNumber = `${row.number}-${suffix}`;
      itemPayload.number = disambiguatedNumber;

      const retry = await sb.from(cfg.remote).upsert([itemPayload], { onConflict: cfg.remotePk });
      if (!retry.error) {
        const nowIso = new Date().toISOString();
        db.prepare(`UPDATE ${cfg.local} SET number = ?, updated_at = ?, synced_at = ? WHERE id = ?`).run(
          disambiguatedNumber,
          nowIso,
          nowIso,
          row.id
        );
        clearSyncFailure(cfg.local, rowId);
        report.pushed++;
        continue;
      }
      recordSyncFailure(cfg.local, rowId, retry.error.message);
      report.errors.push(`push ${cfg.remote}#${rowId}: ${retry.error.message}`);
    } else {
      recordSyncFailure(cfg.local, rowId, error.message);
      report.errors.push(`push ${cfg.remote}#${rowId}: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// PUSH
// ---------------------------------------------------------------------------
async function pushTable(sb: SupabaseClient, cfg: SyncTableConfig, tenantId: string, report: SyncReport) {
  const cols = localColumns(cfg.local);
  const hasTenant = cols.includes('tenant_id');

  // Rattache les lignes orphelines (créées avant le setup cloud) au tenant courant.
  if (hasTenant) {
    db.prepare(`UPDATE ${cfg.local} SET tenant_id = ? WHERE tenant_id IS NULL OR tenant_id = ''`).run(tenantId);
  }

  const dataCols = cols.filter((c) => c !== 'synced_at' && !(cfg.singleton && c === 'id'));
  const markSynced = db.prepare(`UPDATE ${cfg.local} SET synced_at = updated_at WHERE ${cfg.singleton ? 'id = 1' : 'id = ?'} AND updated_at = ?`);

  const quarantined = getQuarantinedIds(cfg.local);

  for (let guard = 0; guard < 500; guard++) {
    const where = hasTenant ? `tenant_id = ? AND ` : '';
    let rows = db
      .prepare(`SELECT * FROM ${cfg.local} WHERE ${where}(synced_at IS NULL OR updated_at > synced_at) LIMIT ${BATCH}`)
      .all(...(hasTenant ? [tenantId] : [])) as Array<Record<string, unknown>>;
    if (rows.length === 0) break;

    // Filtrer les lignes placées en quarantaine après trop d'échecs
    if (quarantined.size > 0) {
      rows = rows.filter((r) => !quarantined.has(String(r.id)));
      if (rows.length === 0) break;
    }

    const payload = rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const c of dataCols) o[toSnake(c)] = c === 'updated_at' ? toIso(r[c]) : r[c] ?? null;
      o.tenant_id = tenantId;
      return o;
    });

    const { error } = await sb.from(cfg.remote).upsert(payload, { onConflict: cfg.remotePk });
    if (error) {
      // Re-tentative unitaire pour ne pas bloquer les autres lignes
      await pushRowFallback(sb, cfg, rows, payload, markSynced, report);
      if (rows.length < BATCH) break;
      continue;
    }

    const tx = db.transaction(() => {
      for (const r of rows) {
        if (cfg.singleton) markSynced.run(r.updated_at);
        else markSynced.run(r.id, r.updated_at);
        clearSyncFailure(cfg.local, String(r.id ?? '1'));
      }
    });
    tx();
    report.pushed += rows.length;
    if (rows.length < BATCH) break;
  }
}

async function pushTombstones(sb: SupabaseClient, tenantId: string, report: SyncReport) {
  const tombs = db.prepare('SELECT table_name, record_id FROM sync_tombstones').all() as Array<{ table_name: string; record_id: string }>;
  if (tombs.length === 0) return;

  const byTable = new Map<string, string[]>();
  for (const t of tombs) {
    const list = byTable.get(t.table_name) ?? [];
    list.push(t.record_id);
    byTable.set(t.table_name, list);
  }

  const del = db.prepare('DELETE FROM sync_tombstones WHERE table_name = ? AND record_id = ?');
  for (const [table, ids] of byTable) {
    const cfg = SYNC_TABLES.find((c) => c.local === table);
    if (!cfg) continue;
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      const { error } = await sb.from(cfg.remote).delete().eq('tenant_id', tenantId).in('id', chunk);
      if (error) throw new Error(`delete ${cfg.remote}: ${error.message}`);
      db.transaction(() => chunk.forEach((id) => del.run(table, id)))();
      report.deleted += chunk.length;
    }
  }
}

// ---------------------------------------------------------------------------
// PULL
// ---------------------------------------------------------------------------
async function pullTable(sb: SupabaseClient, cfg: SyncTableConfig, tenantId: string, report: SyncReport) {
  const cols = localColumns(cfg.local);
  const snakeToLocal = new Map<string, string>();
  for (const c of cols) snakeToLocal.set(toSnake(c), c);

  const cursorKey = `pull:${cfg.local}:${tenantId}`;
  let cursor = parseCursor(getMeta(cursorKey));

  for (let guard = 0; guard < 1000; guard++) {
    let q = sb
      .from(cfg.remote)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('server_updated_at', { ascending: true })
      .order(cfg.remotePk, { ascending: true })
      .limit(PULL_PAGE);

    if (cursor) {
      if (cursor.id) {
        q = q.or(`server_updated_at.gt.${cursor.ts},and(server_updated_at.eq.${cursor.ts},${cfg.remotePk}.gt.${cursor.id})`);
      } else {
        q = q.gt('server_updated_at', cursor.ts);
      }
    }

    const { data, error } = await q;
    if (error) throw new Error(`pull ${cfg.remote}: ${error.message}`);
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) break;

    const selectExisting = db.prepare(`SELECT updated_at FROM ${cfg.local} WHERE ${cfg.singleton ? 'id = 1' : 'id = ?'}`);

    const tx = db.transaction(() => {
      for (const r of rows) {
        try {
          const remoteUpdated = toIso(r.updated_at) ?? toIso(r.server_updated_at) ?? new Date().toISOString();
          const existing = (cfg.singleton ? selectExisting.get() : selectExisting.get(r.id)) as { updated_at: string | null } | undefined;
          if (existing?.updated_at && toIso(existing.updated_at)! >= remoteUpdated) {
            report.skipped++;
            continue; // le local est plus récent (ou identique) : Last-Write-Wins
          }

          const values: Record<string, unknown> = {};
          for (const [snake, val] of Object.entries(r)) {
            const localCol = snakeToLocal.get(snake);
            if (!localCol || localCol === 'synced_at' || snake === 'server_updated_at') continue;
            if (cfg.singleton && localCol === 'id') continue;
            values[localCol] = val;
          }
          if (cfg.singleton) values.id = 1;
          values.updated_at = remoteUpdated;
          values.synced_at = remoteUpdated;

          const names = Object.keys(values);
          const sql = `INSERT INTO ${cfg.local} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})
            ON CONFLICT(id) DO UPDATE SET ${names.filter((n) => n !== 'id').map((n) => `${n} = excluded.${n}`).join(', ')}`;
          db.prepare(sql).run(...names.map((n) => values[n] ?? null));
          clearSyncFailure(cfg.local, String(r.id ?? '1'));
          report.pulled++;
        } catch (e: any) {
          // Contrainte : on isole la ligne en erreur dans sync_failures sans bloquer le reste de la table
          report.skipped++;
          const errMsg = e?.message || String(e);
          recordSyncFailure(cfg.local, String(r.id ?? '1'), errMsg);
          report.errors.push(`pull ${cfg.local}#${String(r.id ?? r.tenant_id)}: ${errMsg}`);
        }
      }
    });
    tx();

    const last = rows[rows.length - 1];
    const lastTs = toIso(last.server_updated_at) ?? toIso(last.updated_at) ?? new Date().toISOString();
    const lastId = String(last[cfg.remotePk] ?? last.id ?? '');
    cursor = { ts: lastTs, id: lastId };
    setMeta(cursorKey, JSON.stringify(cursor));
    if (rows.length < PULL_PAGE) break;
  }
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------
let running = false;

export async function syncWithCloud(accessToken: string): Promise<SyncReport> {
  if (running) throw new Error('Une synchronisation est déjà en cours.');
  running = true;
  const syncStartTime = Date.now();
  try {
    const sb = clientWithToken(accessToken);
    const ctx = await withTimeout(resolveContext(sb, accessToken), 15000, 'contexte');
    const report: SyncReport = { tenantId: ctx.tenantId, pushed: 0, pulled: 0, deleted: 0, skipped: 0, errors: [] };

    // Dérive d'horloge et diagnostic d'isolation tenant
    const drift = await measureClockDrift();
    if (drift !== null && Math.abs(drift) > 120_000) {
      report.errors.push(`Avertissement : Dérive d'horloge de ${Math.round(drift / 1000)}s détectée avec le serveur cloud.`);
    }
    checkTenantIsolation();

    // 0) Comptes Cloud en attente (membres créés hors-ligne sur le Desktop)
    if (ctx.role === 'admin') {
      try {
        const pm = await withTimeout(processPendingMembers(accessToken), 30000, 'membres');
        report.errors.push(...pm.errors);
      } catch (e: any) {
        report.errors.push(e?.message || String(e));
      }
    }

    // 1) PUSH (parents -> enfants), puis suppressions
    for (const cfg of SYNC_TABLES) {
      try {
        await pushTable(sb, cfg, ctx.tenantId, report);
      } catch (e: any) {
        report.errors.push(e?.message || String(e));
      }
    }
    try {
      await pushTombstones(sb, ctx.tenantId, report);
    } catch (e: any) {
      report.errors.push(e?.message || String(e));
    }

    // 2) PULL (parents -> enfants)
    for (const cfg of SYNC_TABLES) {
      try {
        await pullTable(sb, cfg, ctx.tenantId, report);
      } catch (e: any) {
        report.errors.push(e?.message || String(e));
      }
    }

    setMeta('last_sync_at', new Date().toISOString());

    // Télémétrie technique Hub (best-effort, non-bloquante)
    const durationMs = Date.now() - syncStartTime;
    await sendSyncTelemetry(sb, report, durationMs);

    return report;
  } finally {
    running = false;
  }
}

/**
 * Setup : crée le compte admin dans Supabase Auth + tenant (RPC provision_tenant).
 * Best-effort : si le réseau est absent ou si la confirmation e-mail est requise,
 * le provisioning est repris automatiquement à la première synchronisation connectée.
 */
export async function provisionCloudAccount(input: {
  email: string;
  password: string;
  name: string;
  phone?: string | null;
  companyName: string;
  localTenantId?: string | null;
}): Promise<{ status: 'done' | 'queued'; tenantId?: string }> {
  try {
    const { url, anon } = env();
    const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

    let session = null as Awaited<ReturnType<typeof sb.auth.signUp>>['data']['session'];
    const signUp = await withTimeout(
      sb.auth.signUp({ email: input.email, password: input.password, options: { data: { full_name: input.name } } }),
      10000,
      'signUp'
    );
    session = signUp.data.session;

    if (!session) {
      // Compte déjà existant ? tentative de connexion directe.
      const signIn = await withTimeout(sb.auth.signInWithPassword({ email: input.email, password: input.password }), 10000, 'signIn');
      session = signIn.data.session;
    }
    if (!session) return { status: 'queued' }; // confirmation e-mail requise

    const authed = clientWithToken(session.access_token);
    const { data: rpcTenantId, error } = await withTimeout(
      Promise.resolve(
        authed.rpc('provision_tenant', {
          p_company_name: input.companyName,
          p_full_name: input.name,
          p_phone: input.phone || null,
        })
      ),
      10000,
      'provision_tenant'
    );
    if (error) return { status: 'queued' };

    const cloudTenantId = rpcTenantId ? String(rpcTenantId) : undefined;
    if (cloudTenantId) {
      reconcileLocalTenantId(cloudTenantId, input.localTenantId);
    }

    return { status: 'done', tenantId: cloudTenantId };
  } catch (e) {
    console.warn('[CloudSync] Provisioning différé :', (e as Error)?.message);
    return { status: 'queued' };
  }
}
