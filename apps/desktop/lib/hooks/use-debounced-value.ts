"use client"

import * as React from "react"

/**
 * Hook utilitaire de debounce (200ms par défaut) pour éviter de recalculer
 * les filtres lourds ou de déclencher des requêtes SQLite à chaque frappe clavier.
 */
export function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

