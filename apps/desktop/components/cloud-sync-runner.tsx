"use client"

import * as React from "react"
import { toast } from "sonner"
import { supabaseSession } from "@/lib/auth/supabaseSession"
import { runCloudSync } from "@/app/actions/sync.actions"
import { useStore } from "@/lib/store"

const SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Verrous module-level survivant aux remontages React.StrictMode et transitions de pages
let globalIsSyncing = false;
let globalLastSyncAt = 0;

/**
 * CloudSyncRunner — déclenche la synchronisation SQLite <-> Supabase :
 *  - différé au démarrage de 8 secondes pour garantir un premier affichage < 200ms sans contention ;
 *  - à la reconnexion réseau, puis toutes les 10 min ;
 *  - rafraîchit l'UI quand des données ont été reçues du Cloud.
 * Hors-ligne ou sans session Cloud : silencieux (mode local-first).
 */
export function CloudSyncRunner() {
  const userId = useStore(state => state.user?.id)
  const isSyncingRef = React.useRef(false)

  const sync = React.useCallback(async (silent: boolean, ignoreCooldown = false) => {
    if (
      globalIsSyncing ||
      isSyncingRef.current ||
      typeof navigator === "undefined" ||
      !navigator.onLine
    ) {
      return;
    }

    const now = Date.now();
    if (!ignoreCooldown && now - globalLastSyncAt < COOLDOWN_MS) {
      return;
    }

    globalIsSyncing = true;
    isSyncingRef.current = true;
    globalLastSyncAt = now;

    try {
      const { data } = await supabaseSession.client.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const res = await runCloudSync(token);
      globalLastSyncAt = Date.now();

      if (!res.success) {
        if (!silent) toast.error(`Synchronisation : ${res.error}`);
        return;
      }
      const r = res.data;
      if (r.errors.length) console.warn("[CloudSync] Avertissements:", r.errors);
      if (r.pulled > 0 || r.deleted > 0) {
        window.dispatchEvent(new Event("facturier:data-refresh"));
      }
      if (!silent) toast.success(`Synchronisé : ${r.pushed} envoyé(s), ${r.pulled} reçu(s)`);
    } catch (e) {
      console.warn("[CloudSync]", e);
    } finally {
      globalIsSyncing = false;
      isSyncingRef.current = false;
    }
  }, []);

  React.useEffect(() => {
    if (!userId) return;

    // Diffère la première synchronisation de 8 secondes pour libérer le démarrage initial
    const initialTimer = setTimeout(() => sync(true), 8000);

    const timer = setInterval(() => sync(true), SYNC_INTERVAL_MS);

    const onOnline = () => sync(true);
    window.addEventListener("online", onOnline);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [userId, sync]);

  return null
}
