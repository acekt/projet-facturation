import { createClient } from '@supabase/supabase-js';
import db from '@/lib/db';
import { encryptSecret, decryptSecret } from '@/lib/crypto/secretStore';
import { getErrorMessage } from '@/lib/utils/action-error';

/**
 * File d'attente des membres (admin/opérateur) créés sur le Desktop.
 * - enqueueCloudMember : appelé à la création locale (fonctionne hors-ligne).
 * - processPendingMembers : appelé par chaque cycle de synchronisation avec le JWT
 *   de l'admin ; crée le compte Supabase Auth puis le rattache au tenant (attach_member).
 *   En cas d'échec (réseau, etc.), la ligne reste en file et sera retentée au prochain cycle.
 * Le mot de passe est chiffré (AES-256-GCM) dans la file ; il est supprimé
 * dès que le compte Cloud est créé.
 */
interface PendingMember {
  email: string;
  password: string;
  name: string;
  phone: string | null;
  role: string;
}

export function enqueueCloudMember(m: { email: string; password: string; name: string; phone?: string | null; role: 'admin' | 'user' }) {
  if (!m.email || !m.password) return;
  db.prepare(
    `INSERT INTO pending_cloud_members (email, password, name, phone, role)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET password = excluded.password, name = excluded.name,
       phone = excluded.phone, role = excluded.role, attempts = 0, last_error = NULL`
  ).run(m.email.toLowerCase().trim(), encryptSecret(m.password), m.name, m.phone || null, m.role);
}

export async function processPendingMembers(adminAccessToken: string): Promise<{ done: number; errors: string[] }> {
  const result = { done: 0, errors: [] as string[] };
  const rows = db.prepare('SELECT email, password, name, phone, role FROM pending_cloud_members ORDER BY created_at').all() as PendingMember[];
  if (rows.length === 0) return result;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return result;
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const adminClient = createClient(url, anon, { ...opts, global: { headers: { Authorization: `Bearer ${adminAccessToken}` } } });

  for (const row of rows) {
    const m = { ...row, password: '' };
    try {
      m.password = decryptSecret(row.password);
      // Client isolé : la session de l'admin n'est jamais modifiée.
      const anonClient = createClient(url, anon, opts);
      const signUp = await anonClient.auth.signUp({ email: m.email, password: m.password, options: { data: { full_name: m.name } } });
      let userId = signUp.data.user?.id;
      // Compte déjà existant : signUp renvoie un faux utilisateur sans identité -> connexion pour obtenir l'id.
      if (signUp.error || !userId || (signUp.data.user?.identities?.length ?? 1) === 0) {
        const signIn = await anonClient.auth.signInWithPassword({ email: m.email, password: m.password });
        userId = signIn.data.user?.id;
        if (!userId) throw new Error(signUp.error?.message || signIn.error?.message || 'Compte Cloud introuvable');
      }

      const { error } = await adminClient.rpc('attach_member', {
        p_user_id: userId,
        p_role: m.role === 'admin' ? 'admin' : 'user',
        p_full_name: m.name,
        p_phone: m.phone,
      });
      if (error) throw new Error(error.message);

      db.prepare('DELETE FROM pending_cloud_members WHERE email = ?').run(m.email);
      result.done++;
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      result.errors.push(`${m.email}: ${msg}`);
      db.prepare('UPDATE pending_cloud_members SET attempts = attempts + 1, last_error = ? WHERE email = ?').run(msg, m.email);
    }
  }
  return result;
}
