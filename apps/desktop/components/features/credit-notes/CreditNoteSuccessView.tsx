"use client"

import * as React from "react"
import { CheckCircle2, FileText, ArrowRight } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { formatCurrency } from "@/lib/utils"

interface CreditNoteSuccessViewProps {
  noteNumber: string
  clientName: string
  invoiceNumber: string
  amount: number
  newBalance: number
  onClose: () => void
  onPreview?: () => void
}

export function CreditNoteSuccessView({
  noteNumber,
  clientName,
  invoiceNumber,
  amount,
  newBalance,
  onClose,
  onPreview,
}: CreditNoteSuccessViewProps) {
  return (
    <div className="py-4 space-y-5 text-center">
      <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-6 h-6" />
      </div>

      <div>
        <h3 className="text-base font-bold text-foreground">
          Note d&apos;Avoir émise avec succès
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Le remboursement a été enregistré et le solde de la facture a été mis à jour.
        </p>
      </div>

      <div className="bg-secondary/40 border border-border rounded-xl p-4 text-left space-y-2.5 text-xs">
        <div className="flex justify-between items-center pb-2 border-b border-border/60">
          <span className="text-muted-foreground">Numéro d&apos;Avoir généré</span>
          <span className="font-mono font-bold text-foreground text-sm">{noteNumber}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Client bénéficiaire</span>
          <span className="font-medium text-foreground">{clientName}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Facture d&apos;origine</span>
          <span className="font-mono font-semibold text-foreground">{invoiceNumber}</span>
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-border/40">
          <span className="text-muted-foreground font-medium">Montant remboursé / crédité</span>
          <span className="font-bold text-orange-600 text-sm tabular-nums">
            {formatCurrency(amount)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground font-medium">Nouveau solde exigible facture</span>
          <span className="font-bold text-foreground tabular-nums">
            {formatCurrency(newBalance)}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>
          Fermer
        </Button>
        {onPreview && (
          <Button onClick={onPreview} className="gap-2 bg-primary text-primary-foreground">
            <FileText className="w-4 h-4" />
            Voir la Quittance d&apos;Avoir
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

