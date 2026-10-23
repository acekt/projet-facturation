import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { SettingsRepository } from '@/lib/repositories/SettingsRepository';
import { reconcileLocalTenantId } from '@/lib/api/tenant';
import { updateCachedLicenseStatus } from '@/lib/api/license';

export interface IEnrollmentInput {
  email: string;
  password: string;
  tenantKeyOrId?: string | null;
  deviceName?: string | null;
}

export interface IEnrollmentResult {
  userId: string;
  tenantId: string;
  cleanName: string;
  cleanEmail: string;
  role: 'admin' | 'user';
  phone?: string | null;
  companyName: string;
}

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('Configuration Supabase manquante (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).');
  }
  return { url, anon };
}

export const EnrollmentService = {
  /**
   * Enrôle un nouveau poste de travail au sein d'une organisation SaaS existante
   * en vérifiant les identifiants Cloud et le statut de la licence auprès de Supabase.
   */
  async enrollWithCloudTenant(input: IEnrollmentInput): Promise<IEnrollmentResult> {
    const cleanEmail = input.email.trim().toLowerCase();
    const password = input.password;

    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Adresse email invalide');
    }
    if (!password || password.length < 6) {
      throw new Error('Le mot de passe doit comporter au moins 6 caractères');
    }

    const { url, anon } = getSupabaseEnv();
    const sb = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Authentification auprès de Supabase Auth
    const { data: authData, error: authError } = await sb.auth.signInWithPassword({
      email: cleanEmail,
      password: password,
    });

    if (authError || !authData.user || !authData.session) {
      throw new Error(
        authError?.message === 'Invalid login credentials'
          ? 'Identifiants Cloud incorrects (email ou mot de passe)'
          : `Échec d'authentification Cloud : ${authError?.message || 'Erreur inconnue'}`
      );
    }

    const sbUser = authData.user;
    const authedClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2. Récupération du profil utilisateur
    const { data: profile, error: profileErr } = await authedClient
      .from('profiles')
      .select('id, tenant_id, role, full_name, phone, is_active')
      .eq('id', sbUser.id)
      .maybeSingle();

    if (profileErr) {
      throw new Error(`Lecture du profil Cloud impossible : ${profileErr.message}`);
    }

    let effectiveTenantId = profile?.tenant_id ? String(profile.tenant_id) : null;

    // Si le profil n'a pas encore de tenant_id mais qu'une clé/UUID a été fournie
    if (!effectiveTenantId && input.tenantKeyOrId && input.tenantKeyOrId.trim() !== '') {
      effectiveTenantId = input.tenantKeyOrId.trim();
    }

    if (!effectiveTenantId) {
      throw new Error("Aucune organisation Cloud n'est associée à ce compte utilisateur.");
    }

    // 3. Vérification du statut du tenant et de sa licence
    const { data: tenant, error: tenantErr } = await authedClient
      .from('tenants')
      .select('id, name, status, license_expires_at, country')
      .eq('id', effectiveTenantId)
      .maybeSingle();

    if (tenantErr || !tenant) {
      throw new Error("L'organisation spécifiée est introuvable sur le Cloud.");
    }

    if (tenant.status === 'suspended') {
      throw new Error("Cette organisation a été suspendue par l'administrateur du Hub Facturier.");
    }

    const companyName = tenant.name || 'Mon Entreprise';
    const cleanName = profile?.full_name || sbUser.user_metadata?.full_name || cleanEmail.split('@')[0];
    const userRole: 'admin' | 'user' = (profile?.role || '').toLowerCase() === 'admin' ? 'admin' : 'user';

    // 4. Hachage du mot de passe pour persistance locale SQLite (permet la connexion locale autonome hors-ligne)
    const localHashedPassword = await bcrypt.hash(password, 10);

    // 5. Initialisation atomique dans SQLite local
    const setupTx = db.transaction(() => {
      // Utilisateur local (upsert avec ID correspondant au compte Cloud)
      const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? OR id = ?').get(cleanEmail, sbUser.id) as { id: string } | undefined;

      if (existingUser) {
        db.prepare(
          'UPDATE users SET id = ?, password = ?, name = ?, role = ?, is_active = 1, phone = ?, tenant_id = ? WHERE id = ?'
        ).run(
          sbUser.id,
          localHashedPassword,
          cleanName,
          userRole,
          profile?.phone || null,
          effectiveTenantId,
          existingUser.id
        );
      } else {
        UserRepository.create({
          id: sbUser.id,
          username: cleanEmail,
          email: cleanEmail,
          password: localHashedPassword,
          name: cleanName,
          role: userRole,
          is_active: 1,
          force_password_change: 0,
          phone: profile?.phone || null,
          created_by: null,
          tenant_id: effectiveTenantId,
        });
      }

      // Configuration d'entreprise locale
      SettingsRepository.upsertInitialSettings(
        companyName,
        '',
        '',
        '',
        profile?.phone || '',
        cleanEmail
      );

      // Assurer que settings a le tenant_id
      try {
        db.prepare("UPDATE settings SET tenant_id = ? WHERE id = 1").run(effectiveTenantId);
      } catch {
        // ignore
      }

      // Enregistrement des métadonnées de licence et synchronisation
      updateCachedLicenseStatus(
        effectiveTenantId,
        (tenant.status as any) || 'active',
        tenant.license_expires_at
      );

      // Réconciliation des éventuelles données locales orphelines existantes
      reconcileLocalTenantId(effectiveTenantId);
    });

    setupTx();

    return {
      userId: sbUser.id,
      tenantId: effectiveTenantId,
      cleanName,
      cleanEmail,
      role: userRole,
      phone: profile?.phone || null,
      companyName,
    };
  },
};
