"use client"

/**
 * DataSync — Pont entre l'API Next.js et le store Zustand
 * =========================================================
 * Ce composant s'exécute une seule fois au montage de l'application.
 * Il authentifie l'utilisateur puis charge toutes les données métier
 * en parallèle dans le store Zustand.
 *
 * Corrections AXE 3 & AXE 4 :
 *  ✅ Stabilisation des dépendances useEffect (les setters Zustand sont
 *     stables — mais listés explicitement pour éviter le ESLint warning)
 *  ✅ Guard isMounted pour éviter les setState sur composant démonté
 *  ✅ Remplacement de window.location.href (reload brutal) par router.push
 *  ✅ Suppression du polling — un seul fetch au montage, pas de setInterval
 *  ✅ Cleanup propre via AbortController pour annuler les fetches en cours
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"

export function DataSync() {
  const router = useRouter()

  const setClients    = useStore(state => state.setClients)
  const setQuotes     = useStore(state => state.setQuotes)
  const setInvoices   = useStore(state => state.setInvoices)
  const setServices   = useStore(state => state.setServices)
  const setPayments   = useStore(state => state.setPayments)
  const setSettings   = useStore(state => state.setSettings)
  const setCreditNotes = useStore(state => state.setCreditNotes)
  const setUser       = useStore(state => state.setUser)
  const setIsDataLoaded = useStore(state => state.setIsDataLoaded)

  React.useEffect(() => {
    // AbortController pour annuler les fetches si le composant est démonté
    // avant la fin des requêtes (évite les setState sur composant démonté)
    const controller = new AbortController()
    const { signal } = controller

    const fetchAllData = async () => {
      setIsDataLoaded(false)
      try {
        // ── Étape 1 : Vérification de l'authentification
        const authRes = await fetch('/api/auth/me', { signal }).catch(() => null)

        if (!authRes || !authRes.ok) {
          // Non authentifié : rediriger vers la page de connexion
          // On utilise router.push (Next.js) — pas window.location.href
          // pour éviter un rechargement complet de la fenêtre Electron.
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            // Nettoyer le cookie corrompu si nécessaire
            if (authRes?.status === 401) {
              document.cookie = 'auth_session=; path=/; max-age=0';
            }
            router.push('/login')
          }
          return
        }

        const authData = await authRes.json().catch(() => null)
        if (!authData?.user) {
          router.push('/login')
          return
        }

        setUser(authData.user)

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

        // Si le signal a été annulé, on ne traite pas les résultats
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
        // Ne pas loguer les AbortError (annulation normale au démontage)
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('[DataSync] Erreur critique de synchronisation:', error.message)
        }
      }
    }

    fetchAllData()

    // Cleanup : annuler les requêtes en cours si le composant est démonté
    return () => {
      controller.abort()
    }
  // Les setters Zustand sont des fonctions stables (créées une seule fois).
  // On les liste pour satisfaire exhaustive-deps, mais elles ne déclenchent
  // jamais de re-exécution de l'effet en pratique.
  }, [router, setClients, setQuotes, setInvoices, setServices, setPayments, setSettings, setCreditNotes, setUser, setIsDataLoaded])

  return null
}
