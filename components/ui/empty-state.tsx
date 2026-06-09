"use client"

import * as React from "react"
import { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border shadow-sm">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 border border-border/50">
        <Icon className="w-8 h-8 text-muted-foreground opacity-50" />
      </div>
      <h3 className="text-lg font-semibold text-foreground tracking-tight uppercase">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-2 font-bold leading-relaxed uppercase tracking-widest">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="outline" className="mt-8 gap-2 font-semibold text-[10px] uppercase tracking-widest h-10 px-6">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
