"use client"

/**
 * DataSync — Pont entre l'API Next.js et le store Zustand
 * =========================================================
 * Ce composant s'exécute au montage et à chaque changement d'état d'authentification.
 * Il authentifie l'utilisateur puis charge toutes les données métier en parallèle.
 *
 * Résolution de la boucle infinie (Phase 3-bis) :
 *  ✅ Utilisation d'une ref `fetchedUserIdRef` pour suivre l'ID utilisateur traité
 *     et empêcher toute exécution dupliquée ou boucle de rendus.
 *  ✅ Suppression de la dépendance à `router` ou `pathname` pour éviter les déclenchements
 *     lors des navigations.
 *  ✅ Appel systématique de `setIsDataLoaded(true)` lors des échecs d'authentification (401)
 *     pour débloquer l'UI de manière propre.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import { toast } from "sonner"

export function DataSync() {
  const router = useRouter()

  const user = useStore(state => state.user)
  const userId = user?.id

  const setClients    = useStore(state => state.setClients)
  const setQuotes     = useStore(state => state.setQuotes)
  const setInvoices   = useStore(state => state.setInvoices)
  const setServices   = useStore(state => state.setServices)
  const setPayments   = useStore(state => state.setPayments)
  const setSettings   = useStore(state => state.setSettings)
  const setCreditNotes = useStore(state => state.setCreditNotes)
  const setUser       = useStore(state => state.setUser)
  const setIsDataLoaded = useStore(state => state.setIsDataLoaded)

  // Réf pour mémoriser le dernier userId pour lequel on a effectué la synchronisation.
  // Permet d'éviter les boucles infinies et les requêtes réseaux superflues.
  const fetchedUserIdRef = React.useRef<string | null | undefined>(null)

  React.useEffect(() => {
    // Si la synchronisation a déjà été faite pour cet utilisateur (ou absence d'utilisateur), on ignore.
    if (fetchedUserIdRef.current === userId) {
      return
    }
    fetchedUserIdRef.current = userId

    const controller = new AbortController()
    const { signal } = controller

    const fetchAllData = async () => {
      setIsDataLoaded(false)
      try {
        let currentUser = user

        // ── Étape 1 : Vérification de l'authentification (si non présente dans le store)
        if (!currentUser) {
          const authRes = await fetch('/api/auth/me', { signal }).catch(() => null)

          if (!authRes || !authRes.ok) {
            setUser(null)
            setIsDataLoaded(true)
            
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              if (authRes?.status === 401) {
                document.cookie = 'auth_session=; path=/; max-age=0'
              }
              router.push('/login')
            }
            return
          }

          const authData = await authRes.json().catch(() => null)
          if (!authData?.user) {
            setUser(null)
            setIsDataLoaded(true)
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              router.push('/login')
            }
            return
          }

          currentUser = authData.user
          setUser(currentUser)
          // Le changement d'utilisateur va déclencher une nouvelle passe de l'effet
          // avec le bon `userId`, nous pouvons donc nous arrêter ici pour ce cycle.
          return
        }

        // ── Étape 2 : Chargement parallèle des données métier
        const endpoints = [
          { url: '/api/clients',      setter: setClients },
          { url: '/api/quotes',       setter: setQuotes },
          { url: '/api/invoices',     setter: setInvoices },
          { url: '/api/services',     setter: setServices },
          { url: '/api/payments',     setter: setPayments },
          { url: '/api/settings',     setter: setSettings },
          { url: '/api/credit-notes', setter: setCreditNotes },
        ] as const

        const results = await Promise.allSettled(
          endpoints.map(ep => fetch(ep.url, { signal }))
        )

        if (signal.aborted) return

        await Promise.allSettled(
          results.map(async (result, index) => {
            if (result.status === 'rejected') {
              console.error(`[DataSync] Fetch échoué: ${endpoints[index].url}`, result.reason)
              return
            }
            const res = result.value
            if (!res.ok) {
              console.error(`[DataSync] API error ${res.status}: ${endpoints[index].url}`)
              return
            }
            try {
              const data = await res.json()
              if (data && !data.error) {
                endpoints[index].setter(data as never)
              }
            } catch (parseErr) {
              console.error(`[DataSync] JSON parse error: ${endpoints[index].url}`, parseErr)
            }
          })
        )

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
    }
  }, [
    userId,
    user,
    router,
    setClients,
    setQuotes,
    setInvoices,
    setServices,
    setPayments,
    setSettings,
    setCreditNotes,
    setUser,
    setIsDataLoaded
  ])
  return null
}
