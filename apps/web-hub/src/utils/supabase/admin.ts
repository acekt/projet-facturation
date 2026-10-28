import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec droits Service Role (accès direct haute performance sans surcharge RLS).
 * Réservé exclusivement aux requêtes analytiques et d'agrégation du Hub Super Admin
 * protégées en amont par requireSuperadmin().
 */
export function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nsthgydbjfbutinyvbey.supabase.co";
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "dummy-service-role-key-for-test-environments";

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
