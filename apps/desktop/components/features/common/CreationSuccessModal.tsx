"use client"

import * as React from "react"
import { CheckCircle2, FileText, ArrowRight } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { VisuallyHidden } from "@workspace/ui/components/visually-hidden"

export interface CreationSuccessModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle: string
  details: { label: string; value: React.ReactNode; isAmount?: boolean }[]
  onClose: () => void
  onPreview?: () => void
  previewLabel?: string
}

export function CreationSuccessModal({
  isOpen,
  onOpenChange,
  title,
  subtitle,
  details,
  onClose,
  onPreview,
  previewLabel = "Aperçu PDF",
}: CreationSuccessModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md p-6">
        <DialogHeader>
          <VisuallyHidden>
            <DialogTitle>Succès de création</DialogTitle>
            <DialogDescription>Détails de l'entité nouvellement créée</DialogDescription>
          </VisuallyHidden>
        </DialogHeader>

        <div className="py-2 space-y-5 text-center">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-bold text-foreground">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          </div>

          <div className="bg-secondary/40 border border-border rounded-xl p-4 text-left space-y-2.5 text-xs">
            {details.map((detail, idx) => (
              <div
                key={idx}
                className={`flex justify-between items-center ${idx === 0 ? "pb-2 border-b border-border/60" : ""} ${idx === details.length - 1 && details.length > 2 ? "pt-1 border-t border-border/40" : ""}`}
              >
                <span className="text-muted-foreground">{detail.label}</span>
                <span className={`font-medium text-foreground ${detail.isAmount ? "font-bold text-sm tabular-nums" : ""}`}>
                  {detail.value}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
            {onPreview && (
              <Button onClick={onPreview} className="gap-2 bg-primary text-primary-foreground">
                <FileText className="w-4 h-4" />
                {previewLabel}
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
