"use client"

import * as React from "react"
import { Plus, Trash2, AlertCircle, Info } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { formatCurrency } from "@/lib/utils"
import type { Invoice } from "@/lib/store"
import { EditableSelect } from "@/components/features/common/EditableSelect"

const DEFAULT_CREDIT_NOTE_REASONS = [
  "Erreur de facturation sur prix ou quantité",
  "Retour de marchandises ou d'équipements",
  "Remise commerciale accordée après facturation",
  "Annulation partielle ou totale de prestation",
  "Remboursement d'un trop-perçu client",
]

export interface CreditLineDraft {
  id: string
  description: string
  quantity: number
  unitPrice: number
  serviceId?: string | null
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
  onAdjustToRemaining?: () => void
  onRestoreOriginalLines?: () => void
  computedTotals: {
    subtotal: number
    tpsAmount: number
    cssAmount: number
    tvaAmount: number
    total: number
  }
  settings: {
    tpsRate?: number
    cssRate?: number
    tvaRate?: number
  }
  applyCss?: boolean
  onApplyCssChange?: (checked: boolean) => void
  applyTps?: boolean
  onApplyTpsChange?: (checked: boolean) => void
  applyTva?: boolean
  onApplyTvaChange?: (checked: boolean) => void
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
  onAdjustToRemaining,
  onRestoreOriginalLines,
  computedTotals,
  settings,
  applyCss = true,
  onApplyCssChange,
  applyTps = false,
  onApplyTpsChange,
  applyTva = true,
  onApplyTvaChange,
  isExceedingCeiling,
}: CreditNoteFormBodyProps) {
  return (
    <div className="space-y-4 py-1">
      {!initialInvoice ? (
        <div className="space-y-2">
          <Label>Facture concernée <span className="text-destructive">*</span></Label>
          <Select value={selectedInvoiceId} onValueChange={onInvoiceSelect}>
            <SelectTrigger className="bg-secondary/50 border-border truncate max-w-full">
              <SelectValue placeholder="Sélectionner une facture..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-border max-w-[90vw] sm:max-w-[650px]">
              {eligibleInvoices.map((inv) => (
                <SelectItem key={inv.id} value={inv.id} className="truncate">
                  {inv.number} — {inv.clientName} ({formatCurrency(inv.total)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-secondary/50 border border-border flex items-center justify-between gap-2 text-sm">
          <div className="truncate min-w-0">
            <span className="font-mono font-semibold text-foreground">{initialInvoice.number}</span>
            <span className="text-muted-foreground ml-2 truncate">• {initialInvoice.clientName}</span>
          </div>
          <span className="font-semibold tabular-nums shrink-0">{formatCurrency(initialInvoice.total)}</span>
        </div>
      )}

      {activeInvoice && (() => {
        const totalPaid = (activeInvoice.payments || []).reduce((sum, p) => sum + (p.deletedAt ? 0 : p.amount), 0)
        const remainingBeforeCredit = Math.max(0, (activeInvoice.total || 0) - totalPaid)
        const potentialOverpayment = Math.max(0, computedTotals.total - remainingBeforeCredit)

        return (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-secondary/60 border border-border text-foreground">
              <span className="text-muted-foreground font-medium">Plafond d&apos;avoir disponible sur cette facture :</span>
              <span className="font-bold tabular-nums text-foreground">{formatCurrency(maxRefundableTtc)}</span>
            </div>

            {totalPaid === 0 ? (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Nature : Avoir d&apos;imputation (Facture impayée)</span>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    Cette facture n&apos;ayant pas encore été réglée, cet avoir réduira la créance du client. Aucun décaissement de trésorerie ne sera effectué.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Facture avec paiements déjà perçus ({formatCurrency(totalPaid)})</span>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      {potentialOverpayment > 0
                        ? `Cet avoir dégage un trop-perçu de ${formatCurrency(potentialOverpayment)} en faveur du client.`
                        : `Cet avoir viendra déduire le solde restant exigible (${formatCurrency(remainingBeforeCredit)}).`}
                    </p>
                  </div>
                </div>

                {potentialOverpayment > 0 && (
                  <div className="pt-2 border-t border-amber-500/20 space-y-1.5">
                    <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300 block">Modalité du trop-perçu :</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!reason.includes("[Remboursement effectif]")) {
                            onReasonChange(`[Remboursement effectif] ${reason.replace(/\[.*?\]\s*/, "")}`)
                          }
                        }}
                        className={`rounded text-xs whitespace-normal text-center h-auto py-2 px-3 font-semibold cursor-pointer border transition-colors ${
                          reason.includes("[Remboursement effectif]")
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-card text-foreground border-border hover:bg-secondary"
                        }`}
                      >
                        Remboursement effectif (Décaissement)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!reason.includes("[Crédit client]")) {
                            onReasonChange(`[Crédit client] ${reason.replace(/\[.*?\]\s*/, "")}`)
                          }
                        }}
                        className={`rounded text-xs whitespace-normal text-center h-auto py-2 px-3 font-semibold cursor-pointer border transition-colors ${
                          reason.includes("[Crédit client]")
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-card text-foreground border-border hover:bg-secondary"
                        }`}
                      >
                        Crédit client (À valoir)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="cn-reason">Motif légal de l&apos;avoir <span className="text-destructive">*</span></Label>
          <span className="text-[11px] text-muted-foreground">Sélection rapide ou saisie libre</span>
        </div>
        <EditableSelect
          groupKey="credit_note_reason"
          value={reason}
          onChange={(val) => onReasonChange(val)}
          defaultOptions={DEFAULT_CREDIT_NOTE_REASONS}
          placeholder="Choisir un motif standard ou ajouter le vôtre..."
          addPlaceholder="Nouveau motif d'avoir..."
        />
        <Textarea
          id="cn-reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Entrez ou précisez le motif légal de l'avoir"
          rows={2}
          className="bg-secondary/50 border-border"
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Lignes de l&apos;avoir (Montants HT)
          </Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {onAdjustToRemaining && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAdjustToRemaining}
                className="h-7 text-xs gap-1 text-primary hover:text-primary cursor-pointer"
                title="Ajuste automatiquement les montants pour solder exactement le plafond restant"
              >
                Solde restant
              </Button>
            )}
            {onRestoreOriginalLines && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRestoreOriginalLines}
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Rétablit les lignes issues de la facture"
              >
                Lignes d&apos;origine
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={onAddLine} className="h-7 text-xs gap-1">
              <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
            </Button>
          </div>
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

      <div className="p-3 rounded-xl bg-secondary/40 border border-border space-y-2 text-sm">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Sous-total HT</span>
          <span className="tabular-nums font-medium text-foreground">{formatCurrency(computedTotals.subtotal)}</span>
        </div>

        <div className={`flex justify-between items-center text-xs ${!applyCss ? "opacity-60" : ""}`}>
          <label className="flex items-center gap-2 cursor-pointer select-none text-muted-foreground hover:text-foreground">
            <Checkbox
              checked={applyCss}
              onCheckedChange={(v) => onApplyCssChange?.(Boolean(v))}
              disabled={!onApplyCssChange}
              className="h-3.5 w-3.5"
            />
            <span>CSS ({settings.cssRate || 1}%)</span>
          </label>
          <span className="tabular-nums text-foreground">{applyCss ? formatCurrency(computedTotals.cssAmount) : "0 FCFA"}</span>
        </div>

        <div className={`flex justify-between items-center text-xs ${!applyTps ? "opacity-60" : ""}`}>
          <label className="flex items-center gap-2 cursor-pointer select-none text-muted-foreground hover:text-foreground">
            <Checkbox
              checked={applyTps}
              onCheckedChange={(v) => onApplyTpsChange?.(Boolean(v))}
              disabled={!onApplyTpsChange}
              className="h-3.5 w-3.5"
            />
            <span>TPS ({settings.tpsRate || 9.5}%)</span>
          </label>
          <span className="tabular-nums text-foreground">{applyTps ? formatCurrency(computedTotals.tpsAmount) : "0 FCFA"}</span>
        </div>

        <div className={`flex justify-between items-center text-xs ${!applyTva ? "opacity-60" : ""}`}>
          <label className="flex items-center gap-2 cursor-pointer select-none text-muted-foreground hover:text-foreground">
            <Checkbox
              checked={applyTva}
              onCheckedChange={(v) => onApplyTvaChange?.(Boolean(v))}
              disabled={!onApplyTvaChange}
              className="h-3.5 w-3.5"
            />
            <span>TVA ({settings.tvaRate || 18}%)</span>
          </label>
          <span className="tabular-nums text-foreground">
            {applyTva && computedTotals.tvaAmount > 0 ? formatCurrency(computedTotals.tvaAmount) : "0 FCFA (Exonéré)"}
          </span>
        </div>

        <div className="flex justify-between font-bold text-foreground pt-1.5 border-t border-border/60">
          <span>Total Avoir TTC</span>
          <span className="tabular-nums text-primary">{formatCurrency(computedTotals.total)}</span>
        </div>
        {isExceedingCeiling && (
          <div className="flex items-center justify-between gap-2 text-xs text-destructive pt-1.5 border-t border-destructive/20">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Le total TTC dépasse le plafond remboursable ({formatCurrency(maxRefundableTtc)}).</span>
            </div>
            {onAdjustToRemaining && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={onAdjustToRemaining}
                className="h-6 text-[11px] px-2.5 shrink-0 cursor-pointer shadow-xs"
              >
                Ajuster au plafond
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

