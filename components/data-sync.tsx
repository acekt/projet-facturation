"use client"

/**
 * DataSync — Pont entre l'API Next.js et le store Zustand
 * =========================================================
 * L'utilisateur authentifié étant déjà injecté dans le store par le Server Component
 * protecteur via ProtectedAppShell, DataSync ne fait plus aucun appel réseau à /api/auth/me
 * ni aucune redirection.
 *
 * Il se concentre uniquement sur le chargement parallèle des données métier :
 * clients, devis, factures, services, paiements, paramètres et avoirs.
 */

import * as React from "react"
import { useStore } from "@/lib/store"
import { toast } from "sonner"
import { getClients } from "@/app/actions/client.actions"
import { getServices } from "@/app/actions/service.actions"

import { getSettings } from "@/app/actions/settings.actions"

import { getCreditNotes } from "@/app/actions/credit-note.actions"
import { getQuotes } from "@/app/actions/quote.actions"
import { getInvoices } from "@/app/actions/invoice.actions"
import { getPayments } from "@/app/actions/payment.actions"

export function DataSync() {
  const userId = useStore(state => state.user?.id)

  const setClients     = useStore(state => state.setClients)
  const setQuotes      = useStore(state => state.setQuotes)
  const setInvoices    = useStore(state => state.setInvoices)
  const setServices    = useStore(state => state.setServices)
  const setPayments    = useStore(state => state.setPayments)
  const setSettings    = useStore(state => state.setSettings)
  const setCreditNotes = useStore(state => state.setCreditNotes)
  const setIsDataLoaded = useStore(state => state.setIsDataLoaded)

  const fetchedUserIdRef = React.useRef<string | null | undefined>(null)

  React.useEffect(() => {
    if (!userId) return
    if (fetchedUserIdRef.current === userId) return

    fetchedUserIdRef.current = userId

    const controller = new AbortController()
    const { signal } = controller

    const fetchAllData = async () => {
      setIsDataLoaded(false)
      try {
        const endpoints = [
          { action: getClients,       setter: setClients },
          { action: getServices,      setter: setServices },
          { action: getSettings,      setter: setSettings },
          { action: getCreditNotes,   setter: setCreditNotes },
          { action: getQuotes,        setter: setQuotes },
          { action: getInvoices,      setter: setInvoices },
          { action: getPayments,      setter: setPayments },
        ]

        const results = await Promise.allSettled(
          endpoints.map(ep => ep.action().then((res: any) => res?.success ? res.data : null).catch(() => null))
        )

        results.forEach((res, idx) => {
          if (res.status === 'fulfilled' && res.value) {
            const normalizedData = res.value.data !== undefined ? res.value.data : res.value
            endpoints[idx].setter(normalizedData)
          }
        })

        setTimeout(() => {
          setIsDataLoaded(true)
        }, 600)

      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('[DataSync] Erreur critique de synchronisation:', error.message)
          toast.error(
            "Erreur de synchronisation des données. Veuillez vérifier le serveur local.",
            { id: 'datasync-error', duration: 6000 }
          )
        }
        setTimeout(() => {
          setIsDataLoaded(true)
        }, 600)
      }
    }

    fetchAllData()

    return () => {
      controller.abort()
      fetchedUserIdRef.current = null
    }
  }, [
    userId,
    setClients,
    setQuotes,
    setInvoices,
    setServices,
    setPayments,
    setSettings,
    setCreditNotes,
    setIsDataLoaded
  ])

  return null
}
