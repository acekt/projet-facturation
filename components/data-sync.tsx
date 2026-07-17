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
          { url: '/api/clients',      setter: setClients },
          { url: '/api/quotes',       setter: setQuotes },
          { url: '/api/invoices',     setter: setInvoices },
          { url: '/api/services',     setter: setServices },
          { url: '/api/payments',     setter: setPayments },
          { url: '/api/settings',     setter: setSettings },
          { url: '/api/credit-notes', setter: setCreditNotes },
        ]

        const results = await Promise.allSettled(
          endpoints.map(ep =>
            fetch(ep.url, { signal })
              .then(res => (res.ok ? res.json().catch(() => null) : null))
              .catch(() => null)
          )
        )

        results.forEach((res, idx) => {
          if (res.status === 'fulfilled' && res.value) {
            const normalizedData = res.value.data !== undefined ? res.value.data : res.value
            endpoints[idx].setter(normalizedData)
          }
        })

        setIsDataLoaded(true)

      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('[DataSync] Erreur critique de synchronisation:', error.message)
          toast.error(
            "Erreur de synchronisation des données. Veuillez vérifier le serveur local.",
            { id: 'datasync-error', duration: 6000 }
          )
        }
        setIsDataLoaded(true)
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
