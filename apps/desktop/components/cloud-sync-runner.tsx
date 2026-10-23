"use client"

import * as React from "react"
import { toast } from "sonner"
import { connector } from "@/lib/powersync"
import { runCloudSync } from "@/app/actions/sync.actions"
import { useStore } from "@/lib/store"

const SYNC_INTERVAL_MS = 60_000

/**
 * CloudSyncRunner — déclenche la synchronisation SQLite <-> Supabase :
 *  - au démarrage (session Cloud active), à la reconnexion réseau, puis toutes les 60 s ;
 *  - rafraîchit l'UI quand des données ont été reçues du Cloud.
 * Hors-ligne ou sans session Cloud : silencieux (mode local-first).
 */
export function CloudSyncRunner() {
  const userId = useStore(state => state.user?.id)
  const running = React.useRef(false)

  const sync = React.useCallback(async (silent: boolean) => {
    if (running.current || typeof navigator === "undefined" || !navigator.onLine) return
    running.current = true
    try {
      const { data } = await connector.client.auth.getSession()
      const token = data.session?.access_token
      if (!token) return

      const res = await runCloudSync(token)
      if (!res.success) {
        if (!silent) toast.error(`Synchronisation : ${res.error}`)
        return
      }
      const r = res.data
      if (r.errors.length) console.warn("[CloudSync] Avertissements:", r.errors)
      if (r.pulled > 0 || r.deleted > 0) {
        window.dispatchEvent(new Event("facturier:data-refresh"))
      }
      if (!silent) toast.success(`Synchronisé : ${r.pushed} envoyé(s), ${r.pulled} reçu(s)`)
    } catch (e) {
      console.warn("[CloudSync]", e)
    } finally {
      running.current = false
    }
  }, [])

  React.useEffect(() => {
    if (!userId) return
    const first = setTimeout(() => sync(true), 2000)
    const timer = setInterval(() => sync(true), SYNC_INTERVAL_MS)
    const onOnline = () => sync(true)
    window.addEventListener("online", onOnline)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
      window.removeEventListener("online", onOnline)
    }
  }, [userId, sync])

  return null
}
