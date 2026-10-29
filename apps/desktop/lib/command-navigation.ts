"use client"

import * as React from "react"

interface PendingCommandNavigation {
  page: string
  searchQuery?: string
}

let pendingNavigation: PendingCommandNavigation | null = null

const COMMAND_NAV_EVENT = "facturier:command-navigate"

export function dispatchCommandNavigation(
  onNavigate: (page: string) => void,
  page: string,
  searchQuery?: string
): void {
  if (searchQuery) {
    pendingNavigation = { page, searchQuery }
  } else {
    pendingNavigation = null
  }
  onNavigate(page)
  if (typeof window !== "undefined" && searchQuery) {
    window.dispatchEvent(
      new CustomEvent<PendingCommandNavigation>(COMMAND_NAV_EVENT, {
        detail: { page, searchQuery },
      })
    )
  }
}

export function useCommandFilter(
  pageKey: string,
  setSearchQuery: (query: string) => void
): void {
  React.useEffect(() => {
    if (pendingNavigation && pendingNavigation.page === pageKey && pendingNavigation.searchQuery) {
      setSearchQuery(pendingNavigation.searchQuery)
      pendingNavigation = null
    }

    const handler = (event: Event) => {
      const custom = event as CustomEvent<PendingCommandNavigation>
      if (custom.detail?.page === pageKey && custom.detail.searchQuery) {
        setSearchQuery(custom.detail.searchQuery)
        pendingNavigation = null
      }
    }

    window.addEventListener(COMMAND_NAV_EVENT, handler)
    return () => window.removeEventListener(COMMAND_NAV_EVENT, handler)
  }, [pageKey, setSearchQuery])
}

