"use client"

import * as React from "react"
import { Plus, Trash2, AlertCircle } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { formatCurrency } from "@/lib/utils"
import type { Invoice } from "@/lib/store"

export interface CreditLineDraft {
  id: string
  description: string
  quantity: number
  unitPrice: number
}

interface CreditNoteFormBodyProps {
  initialInvoice?: Invoice | null
  activeInvoice: Invoice | null
  eligibleInvoices: Invoice[]
  selectedInvoiceId: string
  onInvoiceSelect: (id: string) => void
  maxRefundableTtc: number
  reason: string
  onReasonChange: (val: string) => void
  lines: CreditLineDraft[]
  onUpdateLine: (index: number, patch: Partial<CreditLineDraft>) => void
  onAddLine: () => void
  onRemoveLine: (index: number) => void
  computedTotals: {
    subtotal: number
    tpsAmount: number
    cssAmount: number
    total: number
  }
  settings: {
    tpsRate?: number
    cssRate?: number
  }
  isExceedingCeiling: boolean
}

export function CreditNoteFormBody({
  initialInvoice,
  activeInvoice,
  eligibleInvoices,
  selectedInvoiceId,
  onInvoiceSelect,
  maxRefundableTtc,
  reason,
  onReasonChange,
  lines,
  onUpdateLine,
  onAddLine,
  onRemoveLine,
  computedTotals,
  settings,
  isExceedingCeiling,
}: CreditNoteFormBodyProps) {
  return (
    <div className="space-y-4 py-2">
      {!initialInvoice ? (
        <div className="space-y-2">
          <Label>Facture concernée <span className="text-destructive">*</span></Label>
          <Select value={selectedInvoiceId} onValueChange={onInvoiceSelect}>
            <SelectTrigger className="bg-secondary/50 border-border">
              <SelectValue placeholder="Sélectionner une facture..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {eligibleInvoices.map((inv) => (
                <SelectItem key={inv.id} value={inv.id}>
                  {inv.number} — {inv.clientName} ({formatCurrency(inv.total)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-secondary/50 border border-border flex items-center justify-between text-sm">
          <div>
            <span className="font-mono font-semibold text-foreground">{initialInvoice.number}</span>
            <span className="text-muted-foreground ml-2">• {initialInvoice.clientName}</span>
          </div>
          <span className="font-semibold tabular-nums">{formatCurrency(initialInvoice.total)}</span>
        </div>
      )}

      {activeInvoice && (
        <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-300">
          <span>Plafond remboursable TTC sur cette facture :</span>
          <span className="font-bold tabular-nums">{formatCurrency(maxRefundableTtc)}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="cn-reason">Motif légal de l&apos;avoir <span className="text-destructive">*</span></Label>
        <Textarea
          id="cn-reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Ex: Retour partiel de marchandises, remise commerciale accordée, erreur de facturation..."
          rows={2}
          className="bg-secondary/50 border-border"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Lignes de l&apos;avoir (Montants HT)
          </Label>
          <Button type="button" variant="outline" size="sm" onClick={onAddLine} className="h-7 text-xs gap-1">
            <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
          </Button>
        </div>

        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {lines.map((line, index) => (
            <div key={line.id} className="grid grid-cols-12 gap-2 items-center bg-secondary/30 p-2 rounded-lg border border-border">
              <div className="col-span-6">
                <Input
                  value={line.description}
                  onChange={(e) => onUpdateLine(index, { description: e.target.value })}
                  placeholder="Description..."
                  className="h-8 text-xs bg-card"
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={line.quantity}
                  onChange={(e) => onUpdateLine(index, { quantity: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-xs bg-card tabular-nums"
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={line.unitPrice}
                  onChange={(e) => onUpdateLine(index, { unitPrice: Math.round(parseFloat(e.target.value) || 0) })}
                  className="h-8 text-xs bg-card tabular-nums text-right"
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={lines.length <= 1}
                  onClick={() => onRemoveLine(index)}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 rounded-xl bg-secondary/40 border border-border space-y-1.5 text-sm">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Sous-total HT</span>
          <span className="tabular-nums">{formatCurrency(computedTotals.subtotal)}</span>
        </div>
        {computedTotals.tpsAmount > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>TPS ({settings.tpsRate ?? 9.5}%)</span>
            <span className="tabular-nums">{formatCurrency(computedTotals.tpsAmount)}</span>
          </div>
        )}
        {computedTotals.cssAmount > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>CSS ({settings.cssRate ?? 1}%)</span>
            <span className="tabular-nums">{formatCurrency(computedTotals.cssAmount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border/60">
          <span>Total Avoir TTC</span>
          <span className="tabular-nums text-orange-600">{formatCurrency(computedTotals.total)}</span>
        </div>
        {isExceedingCeiling && (
          <div className="flex items-center gap-1.5 text-xs text-destructive pt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Le total TTC dépasse le plafond remboursable de la facture.</span>
          </div>
        )}
      </div>
    </div>
  )
}

