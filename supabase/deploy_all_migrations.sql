-- =============================================================================
-- FACTURIER HUB & SPOKE — DÉPLOIEMENT CONSOLIDÉ PRODUCTION (SUPABASE CLOUD)
-- =============================================================================
-- Date de consolidation : 22 Octobre 2026
-- Compatible : PostgreSQL 15+ / Supabase Cloud
-- Idempotence : 100% exécutable plusieurs fois sans interruption ni perte de données
--
-- Contenu du bundle :
--   1. Profils, Tenants & Rattachement Utilisateurs (20261013_attach_member.sql)
--   2. Réplication Desktop SQLite <-> Supabase & RLS (20261013_desktop_sync.sql)
--   3. Sécurité Hub, Hook JWT & Audit Immuable (20261020_hub_security.sql)
--   4. Modèles SaaS, Flotte Desktop, Télémétrie & Rollup KPIs (20261021_hub_telemetry_kpis.sql)
--   5. Requête de Vérification d'Intégrité Globale
-- =============================================================================

\echo '>>> Début du déploiement des migrations de production Facturier...'

-- =============================================================================
-- SECTION 1 : Tables fondamentales Multi-Tenant & Profils
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  email text,
  role text NOT NULL DEFAULT 'user',
  full_name text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (lower(role) IN ('superadmin', 'super_admin', 'admin', 'user', 'operateur', 'operator'));

-- =============================================================================
-- SECTION 2 : Fonctions Utilitaires & Sécurité RLS de Base
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT lower(role) IN ('superadmin', 'super_admin') FROM public.profiles WHERE id = auth.uid()), false)
$$;

CREATE OR REPLACE FUNCTION public.touch_server_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.server_updated_at := now();
  RETURN new;
END;
$$;

-- RLS sur profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', p.policyname);
  END LOOP;
END $$;

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR tenant_id::text = public.current_tenant_id() OR public.is_superadmin());

CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY profiles_superadmin_all ON public.profiles FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- RLS sur tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenants' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tenants', p.policyname);
  END LOOP;
END $$;

CREATE POLICY tenants_select ON public.tenants FOR SELECT TO authenticated
  USING (id::text = public.current_tenant_id() OR public.is_superadmin());

CREATE POLICY tenants_superadmin_all ON public.tenants FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- =============================================================================
-- SECTION 3 : Fonctions RPC d'Enrôlement et Rattachement
-- =============================================================================

CREATE OR REPLACE FUNCTION public.attach_member(
  p_user_id uuid,
  p_role text DEFAULT 'user',
  p_full_name text DEFAULT null,
  p_phone text DEFAULT null
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_role text;
  v_tenant public.profiles.tenant_id%TYPE;
  v_target_tenant text;
  v_email text;
  v_role text := CASE WHEN lower(coalesce(p_role, '')) = 'admin' THEN 'admin' ELSE 'user' END;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT lower(role), tenant_id INTO v_caller_role, v_tenant FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  SELECT tenant_id::text INTO v_target_tenant FROM public.profiles WHERE id = p_user_id;
  IF v_target_tenant IS NOT NULL AND v_target_tenant <> v_tenant::text THEN
    RAISE EXCEPTION 'user belongs to another tenant';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'unknown user'; END IF;

  INSERT INTO public.profiles (id, tenant_id, email, role, full_name, phone)
    VALUES (p_user_id, v_tenant, v_email, v_role, p_full_name, p_phone)
  ON CONFLICT (id) DO UPDATE
    SET tenant_id = excluded.tenant_id,
        role = excluded.role,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        phone = coalesce(excluded.phone, public.profiles.phone);
END $$;

REVOKE ALL ON FUNCTION public.attach_member(uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.attach_member(uuid, text, text, text) TO authenticated;

-- =============================================================================
-- SECTION 4 : Tables Métier Synchronisées avec le Client Desktop SQLite
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.clients (
  id text PRIMARY KEY, tenant_id text NOT NULL,
  name text NOT NULL, rccm text, nif text, address text, city text,
  email text, phone text, client_type text, notes text, is_active integer DEFAULT 1,
  created_at text, updated_at timestamptz, server_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.services (
  id text PRIMARY KEY, tenant_id text NOT NULL,
  code text, name text NOT NULL, description text, unit_price double precision DEFAULT 0,
  tax_rate double precision DEFAULT 18, is_active integer DEFAULT 1,
  created_at text, updated_at timestamptz, server_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotes (
  id text PRIMARY KEY, tenant_id text NOT NULL,
  number text, client_id text, client_name text, date text, validity_date text,
  payment_terms text, notes text, subtotal double precision, tax_base double precision,
  tps_amount double precision, tva_amount double precision, css_amount double precision,
  total double precision, status text, converted_to_invoice_id text,
  created_at text, created_by text, deleted_at text,
  updated_at timestamptz, server_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quote_items (
  id text PRIMARY KEY, tenant_id text NOT NULL,
  quote_id text, description text, quantity double precision, unit_price double precision, total double precision,
  updated_at timestamptz, server_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id text PRIMARY KEY, tenant_id text NOT NULL,
  number text, quote_id text, client_id text, client_name text, date text, due_date text,
  payment_terms text, notes text, subtotal double precision, tax_base double precision,
  tps_amount double precision, tva_amount double precision, css_amount double precision,
  total double precision, paid_amount double precision DEFAULT 0, remaining_amount double precision,
  status text, created_at text, created_by text, deleted_at text,
  updated_at timestamptz, server_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id text PRIMARY KEY, tenant_id text NOT NULL,
  invoice_id text, description text, quantity double precision, unit_price double precision, total double precision,
  updated_at timestamptz, server_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id text PRIMARY KEY, tenant_id text NOT NULL,
  invoice_id text, amount double precision, payment_date text, payment_method text,
  reference text, notes text, receipt_number text, bank_name text,
  created_at text, deleted_at text, created_by text,
  updated_at timestamptz, server_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_notes (
  id text PRIMARY KEY, tenant_id text NOT NULL,
  number text, invoice_id text, client_id text, client_name text, date text, reason text,
  subtotal double precision, tax_base double precision,
  tps_amount double precision, tva_amount double precision, css_amount double precision,
  total double precision, status text,
  created_at text, created_by text, deleted_at text,
  updated_at timestamptz, server_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_note_items (
  id text PRIMARY KEY, tenant_id text NOT NULL,
  credit_note_id text, description text, quantity double precision, unit_price double precision, total double precision,
  updated_at timestamptz, server_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id text PRIMARY KEY, tenant_id text NOT NULL,
  user_id text, user_name text, action text, entity_type text, entity_id text, details text,
  created_at text,
  updated_at timestamptz, server_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_settings (
  tenant_id text PRIMARY KEY,
  company_name text, legal_form text, nif text, rccm text, address text, email text, phone text,
  bank_name text, bank_agency text, account_number text, swift_code text, iban text,
  tva_rate double precision, tps_rate double precision, css_rate double precision,
  session_timeout integer, invoice_prefix text, quote_prefix text, company_code text,
  mentions_legales text, logo text,
  updated_at timestamptz, server_updated_at timestamptz NOT NULL DEFAULT now()
);

-- Triggers horodatage & RLS Multi-Tenant sur les tables répliquées
DO $$
DECLARE
  t text;
  tables text[] := array['clients','services','quotes','quote_items','invoices','invoice_items',
                         'payments','credit_notes','credit_note_items','audit_logs','tenant_settings'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id, server_updated_at)', 'idx_' || t || '_sync', t);

    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_server_ts ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_server_ts BEFORE INSERT OR UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.touch_server_updated_at()', t, t);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON public.%I FOR ALL TO authenticated
                    USING (tenant_id = public.current_tenant_id() OR public.is_superadmin())
                    WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_superadmin())', t);
  END LOOP;
END $$;

-- Anti-collision de numérotation séquentielle par tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_quotes_tenant_number ON public.quotes (tenant_id, number) WHERE number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_tenant_number ON public.invoices (tenant_id, number) WHERE number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_notes_tenant_number ON public.credit_notes (tenant_id, number) WHERE number IS NOT NULL;

-- =============================================================================
-- SECTION 5 : Sécurité Super Admin, Hook JWT (GoTrue) & MFA AAL2
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  claims := event->'claims';
  SELECT lower(role) INTO user_role FROM public.profiles WHERE id = (event->>'user_id')::uuid;

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  ELSE
    claims := jsonb_set(claims, '{user_role}', to_jsonb('user'::text));
  END IF;

  RETURN jsonb_build_object('claims', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

CREATE OR REPLACE FUNCTION public.is_superadmin_aal2()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_superadmin() AND coalesce((auth.jwt()->>'aal'), 'aal1') = 'aal2'
$$;

-- Table d'audit des actions Super Admin du Hub
CREATE TABLE IF NOT EXISTS public.hub_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  actor_email text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_hub_audit_logs_actor ON public.hub_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_hub_audit_logs_tenant ON public.hub_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_audit_logs_created_at ON public.hub_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_audit_logs_action ON public.hub_audit_logs(action);

ALTER TABLE public.hub_audit_logs ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hub_audit_logs' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.hub_audit_logs', p.policyname);
  END LOOP;
END $$;

CREATE POLICY hub_audit_logs_select ON public.hub_audit_logs FOR SELECT TO authenticated
  USING (public.is_superadmin());

CREATE POLICY hub_audit_logs_insert ON public.hub_audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin() AND actor_id = auth.uid());

-- =============================================================================
-- SECTION 6 : Modèles SaaS, Flotte Desktop, Télémétrie & Rollup KPIs
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  price_xaf numeric NOT NULL DEFAULT 0,
  billing_period text NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'annual', 'lifetime')),
  max_users int NOT NULL DEFAULT 5,
  max_devices int NOT NULL DEFAULT 3,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.plans (code, name, description, price_xaf, billing_period, max_users, max_devices, features)
VALUES
  ('free_trial', 'Essai Gratuit', 'Période d''évaluation complète 14 jours', 0, 'monthly', 2, 2, '{"sync": true, "multi_device": true, "export_csv": true}'::jsonb),
  ('starter', 'Plan Starter', 'Pour artisans et indépendants', 15000, 'monthly', 3, 2, '{"sync": true, "multi_device": true, "export_csv": true, "support": "email"}'::jsonb),
  ('pro', 'Plan Pro PME', 'Pour PME avec équipe de facturation', 35000, 'monthly', 10, 5, '{"sync": true, "multi_device": true, "export_csv": true, "support": "priority", "analytics": true}'::jsonb),
  ('enterprise', 'Plan Entreprise', 'Multi-postes étendu et support dédié', 75000, 'monthly', 50, 20, '{"sync": true, "multi_device": true, "export_csv": true, "support": "dedicated", "analytics": true, "custom_sla": true}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  price_xaf = excluded.price_xaf,
  max_users = excluded.max_users,
  max_devices = excluded.max_devices,
  features = excluded.features;

-- Colonnes SaaS sur tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('active', 'trial', 'suspended', 'expired'));

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS license_expires_at timestamptz;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS country text DEFAULT 'Cameroun';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS suspended_reason text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS notes text;

UPDATE public.tenants
SET plan_id = (SELECT id FROM public.plans WHERE code = 'starter' LIMIT 1)
WHERE plan_id IS NULL;

-- Flotte des Postes Desktop
CREATE TABLE IF NOT EXISTS public.sync_devices (
  device_id text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  device_name text,
  os text,
  app_version text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_sync_at timestamptz,
  last_status text NOT NULL DEFAULT 'success' CHECK (last_status IN ('success', 'error', 'pending')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (device_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_devices_tenant ON public.sync_devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_devices_last_seen ON public.sync_devices(last_seen_at DESC);

-- Journal d'exécution des synchronisations
CREATE TABLE IF NOT EXISTS public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz DEFAULT now(),
  duration_ms int NOT NULL DEFAULT 0,
  pushed int NOT NULL DEFAULT 0,
  pulled int NOT NULL DEFAULT 0,
  deleted int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  app_version text,
  os text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_tenant_created ON public.sync_runs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_created_at ON public.sync_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_device ON public.sync_runs(device_id);

-- Annonces et communications broadcast
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  is_active boolean NOT NULL DEFAULT true,
  target_tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_tenant ON public.announcements(target_tenant_id);

-- Rollup des KPIs Quotidiens par Tenant
CREATE TABLE IF NOT EXISTS public.kpi_tenant_daily (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  documents_created int NOT NULL DEFAULT 0,
  invoices_count int NOT NULL DEFAULT 0,
  quotes_count int NOT NULL DEFAULT 0,
  total_revenue_xaf numeric NOT NULL DEFAULT 0,
  total_paid_xaf numeric NOT NULL DEFAULT 0,
  active_users_count int NOT NULL DEFAULT 0,
  sync_count int NOT NULL DEFAULT 0,
  sync_errors_count int NOT NULL DEFAULT 0,
  avg_sync_duration_ms int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_kpi_tenant_daily_date ON public.kpi_tenant_daily(metric_date DESC);

-- Activation RLS et Politiques pour SaaS / Télémétrie
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_tenant_daily ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
    AND tablename IN ('plans', 'sync_devices', 'sync_runs', 'announcements', 'kpi_tenant_daily') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- Plans : lecture pour tous authentifiés, écriture Super Admin
CREATE POLICY plans_read ON public.plans FOR SELECT TO authenticated USING (true);
CREATE POLICY plans_admin ON public.plans FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- Sync Devices : insertion/mise à jour par le tenant propriétaire ou Super Admin
CREATE POLICY sync_devices_tenant_all ON public.sync_devices FOR ALL TO authenticated
  USING (tenant_id::text = public.current_tenant_id() OR public.is_superadmin())
  WITH CHECK (tenant_id::text = public.current_tenant_id() OR public.is_superadmin());

-- Sync Runs : insertion par le tenant, lecture par le tenant ou Super Admin
CREATE POLICY sync_runs_tenant_insert ON public.sync_runs FOR INSERT TO authenticated
  WITH CHECK (tenant_id::text = public.current_tenant_id() OR public.is_superadmin());
CREATE POLICY sync_runs_tenant_select ON public.sync_runs FOR SELECT TO authenticated
  USING (tenant_id::text = public.current_tenant_id() OR public.is_superadmin());

-- Annonces : lecture tenant ou superadmin, écriture Super Admin uniquement
CREATE POLICY announcements_read ON public.announcements FOR SELECT TO authenticated
  USING (
    is_active = true AND
    (expires_at IS NULL OR expires_at > now()) AND
    (target_tenant_id IS NULL OR target_tenant_id::text = public.current_tenant_id() OR public.is_superadmin())
  );
CREATE POLICY announcements_admin_write ON public.announcements FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- KPIs : lecture Super Admin uniquement
CREATE POLICY kpi_tenant_daily_admin ON public.kpi_tenant_daily FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- =============================================================================
-- SECTION 7 : Contrôle d'Intégrité Post-Déploiement
-- =============================================================================

SELECT
  'Tables Répliquées & SaaS' AS categorie,
  count(*) AS total_tables,
  array_agg(tablename ORDER BY tablename) AS tables_presentes
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'tenants', 'profiles', 'clients', 'services', 'quotes', 'quote_items',
    'invoices', 'invoice_items', 'payments', 'credit_notes', 'credit_note_items',
    'audit_logs', 'tenant_settings', 'announcements', 'plans', 'sync_devices',
    'sync_runs', 'hub_audit_logs', 'kpi_tenant_daily'
  );

\echo '>>> Déploiement consolidé de production terminé avec succès.'
