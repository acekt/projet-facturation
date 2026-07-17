"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ViewFormatSelector } from "@/components/ui/view-format-selector"
import { useStore } from "@/lib/store"

export interface SearchBarProps {
  placeholder?: string
  value: string
  onChange: (value: string) => void
  viewFormatKey?: 'clients' | 'invoices' | 'quotes' | 'services'
  className?: string
}

export function SearchBar({
  placeholder = "Rechercher...",
  value,
  onChange,
  viewFormatKey,
  className,
}: SearchBarProps) {
  const viewFormat = useStore((state) => state.viewFormat)
  const setViewFormat = useStore((state) => state.setViewFormat)

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9 bg-secondary border-border text-foreground"
        />
      </div>
      {viewFormatKey && viewFormat && setViewFormat && (
        <ViewFormatSelector
          currentFormat={viewFormat[viewFormatKey] || 'table'}
          onFormatChange={(format) => setViewFormat(viewFormatKey, format)}
        />
      )}
    </div>
  )
}
