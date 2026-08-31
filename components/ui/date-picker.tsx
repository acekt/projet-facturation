"use client"

import * as React from "react"
import { format, isValid } from "date-fns"
import { fr } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  /** Valeur ISO YYYY-MM-DD (stockee en base) */
  value: string
  onChange: (isoDate: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * DatePicker FR -- Popover + Calendar
 * - Affichage : JJ/MM/AAAA (date-fns locale fr)
 * - Stockage  : YYYY-MM-DD (ISO) pour la base SQLite
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "JJ/MM/AAAA",
  disabled = false,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const selected: Date | undefined = React.useMemo(() => {
    if (!value) return undefined
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-").map(Number)
      const dt = new Date(y, m - 1, d)
      return isValid(dt) ? dt : undefined
    }
    return undefined
  }, [value])

  const handleSelect = (day: Date | undefined) => {
    if (!day) return
    const iso = format(day, "yyyy-MM-dd")
    onChange(iso)
    setOpen(false)
  }

  const displayLabel = selected
    ? format(selected, "dd/MM/yyyy", { locale: fr })
    : null

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal bg-secondary border-border text-foreground",
            !displayLabel && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          {displayLabel ?? placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          defaultMonth={selected}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}