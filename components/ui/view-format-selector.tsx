"use client"

import * as React from "react"
import { LayoutList, Rows, Grid3x3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface ViewFormatSelectorProps {
  currentFormat: 'table' | 'horizontal' | 'block'
  onFormatChange: (format: 'table' | 'horizontal' | 'block') => void
}

export function ViewFormatSelector({ currentFormat, onFormatChange }: ViewFormatSelectorProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1 border border-border">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 w-8 p-0",
                currentFormat === 'table' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onFormatChange('table')}
            >
              <LayoutList className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Tableau</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 w-8 p-0",
                currentFormat === 'horizontal' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onFormatChange('horizontal')}
            >
              <Rows className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Horizontal</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 w-8 p-0",
                currentFormat === 'block' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onFormatChange('block')}
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Blocs</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
