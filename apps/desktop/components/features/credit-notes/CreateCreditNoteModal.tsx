"use client"

import * as React from "react"
import { RefreshCcw, Plus, Trash2, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
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
import { createCreditNote, getCreditNotes } from "@/app/actions/credit-note.actions"
import { getInvoices } from "@/app/actions/invoice.actions"
import { computeTotals } from "@/lib/math-logic"
import { useStore, type Invoice, type CreditNote } from "@/lib/store"
import { formatCurrency } from "@/lib/utils"
import { INVOICE_STATUS } from "@/lib/constants"
import { toast } from "sonner"

interface CreditLineDraft {
  id: string
  description: string
  quantity: number
  unitPrice: number
}

interface CreateCreditNoteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialInvoice?: Invoice | null
  invoices: Invoice[]
  creditNotes: CreditNote[]
  onSuccess?: () => void
}

export function CreateCreditNoteModal({
  open,
  onOpenChange,
  initialInvoice = null,
  invoices,
  creditNotes,
  onSuccess,
}: CreateCreditNoteModalProps) {
  const settings = useStore((s) => s.settings)
  const setInvoices = useStore((s) => s.setInvoices)
  const setCreditNotes = useStore((s) => s.setCreditNotes)

  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState<string>("")
  const [reason, setReason] = React.useState<string>("")
  const [lines, setLines] = React.useState<CreditLineDraft[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const eligibleInvoices = React.useMemo(() => {
    return invoices.filter((inv) => inv.status !== INVOICE_STATUS.CANCELLED)
  }, [invoices])

  const activeInvoice = React.useMemo(() => {
    if (initialInvoice) return initialInvoice
    return eligibleInvoices.find((inv) => inv.id === selectedInvoiceId) || null
  }, [initialInvoice, eligibleInvoices, selectedInvoiceId])

  const alreadyCreditedTotal = React.useMemo(() => {
    if (!activeInvoice) return 0
    return creditNotes
      .filter((cn) => cn.invoiceId === activeInvoice.id && cn.status !== "cancelled")
      .reduce((sum, cn) => sum + Math.round(cn.total || 0), 0)
  }, [activeInvoice, creditNotes])

  const maxRefundableTtc = React.useMemo(() => {
    if (!activeInvoice) return 0
    return Math.max(0, Math.round(activeInvoice.total) - alreadyCreditedTotal)
  }, [activeInvoice, alreadyCreditedTotal])

  React.useEffect(() => {
    if (!open) return
    const target = initialInvoice || eligibleInvoices[0] || null
    setSelectedInvoiceId(target?.id || "")
    setReason("")
    if (target && target.items && target.items.length > 0) {
      setLines(
        target.items.map((it, idx) => ({
          id: `${idx}-${it.id || "line"}`,
          description: it.description,
          quantity: Number(it.quantity) || 1,
          unitPrice: Math.round(Number(it.unitPrice) || 0),
        }))
      )
    } else {
      setLines([{ id: "line-0", description: "Avoir commercial", quantity: 1, unitPrice: 0 }])
    }
  }, [open, initialInvoice, eligibleInvoices])

  const handleInvoiceSelect = (invId: string) => {
    setSelectedInvoiceId(invId)
    const target = eligibleInvoices.find((i) => i.id === invId)
    if (target && target.items && target.items.length > 0) {
      setLines(
        target.items.map((it, idx) => ({
          id: `${idx}-${it.id || "line"}`,
          description: it.description,
          quantity: Number(it.quantity) || 1,
          unitPrice: Math.round(Number(it.unitPrice) || 0),
        }))
      )
    }
  }

  const computedTotals = React.useMemo(() => {
    return computeTotals(
      lines.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity) || 0,
        unitPrice: Math.round(Number(l.unitPrice) || 0),
      })),
      0,
      {
        tvaRate: settings.tvaRate ?? 18,
        tpsRate: settings.tpsRate ?? 9.5,
        cssRate: settings.cssRate ?? 1,
      }
    )
  }, [lines, settings.tvaRate, settings.tpsRate, settings.cssRate])

  const isExceedingCeiling = activeInvoice ? computedTotals.total > maxRefundableTtc : false

  const updateLine = (index: number, patch: Partial<CreditLineDraft>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        description: "Remise ou régularisation",
        quantity: 1,
        unitPrice: 0,
      },
    ])
  }

  const removeLine = (index: number) => {
    if (lines.length <= 1) return
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!activeInvoice || isSubmitting) return
    if (!reason.trim()) {
      toast.error("Veuillez saisir le motif légal OHADA de l'avoir.")
      return
    }
    const validItems = lines
      .filter((l) => l.description.trim() && l.quantity > 0 && l.unitPrice >= 0)
      .map((l) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity),
        unitPrice: Math.round(Number(l.unitPrice)),
      }))

    if (validItems.length === 0 || computedTotals.total <= 0) {
      toast.error("Le montant total de l'avoir doit être supérieur à 0 FCFA.")
      return
    }
    if (isExceedingCeiling) {
      toast.error(
        `Le montant TTC de l'avoir (${formatCurrency(computedTotals.total)}) dépasse le plafond remboursable (${formatCurrency(maxRefundableTtc)}).`
      )
      return
    }

    setIsSubmitting(true)
    try {
      const res = await createCreditNote({
        invoiceId: activeInvoice.id,
        reason: reason.trim(),
        items: validItems,
      })

      if (!res.success) {
        toast.error(res.error || "Erreur lors de l'émission de l'avoir")
        return
      }

      const [updatedNotes, updatedInvoices] = await Promise.all([
        getCreditNotes(),
        getInvoices(),
      ])
      if (updatedNotes.success && updatedNotes.data) setCreditNotes(updatedNotes.data)
      if (updatedInvoices.success && updatedInvoices.data) setInvoices(updatedInvoices.data)

      toast.success(`Avoir ${res.data?.number || ""} émis avec succès`)
      onOpenChange(false)
      onSuccess?.()
    } catch {
      toast.error("Erreur lors de la création de l'avoir")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <RefreshCcw className="w-5 h-5 text-orange-600" />
            Émettre une note d&apos;avoir (OHADA)
          </DialogTitle>
          <DialogDescription>
            Créez un avoir partiel ou total rattaché à une facture existante.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!initialInvoice ? (
            <div className="space-y-2">
              <Label>Facture concernée <span className="text-destructive">*</span></Label>
              <Select value={selectedInvoiceId} onValueChange={handleInvoiceSelect}>
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
              onChange={(e) => setReason(e.target.value)}
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
              <Button type="button" variant="outline" size="sm" onClick={addLine} className="h-7 text-xs gap-1">
                <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
              </Button>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {lines.map((line, index) => (
                <div key={line.id} className="grid grid-cols-12 gap-2 items-center bg-secondary/30 p-2 rounded-lg border border-border">
                  <div className="col-span-6">
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
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
                      onChange={(e) => updateLine(index, { quantity: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs bg-card tabular-nums"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(index, { unitPrice: Math.round(parseFloat(e.target.value) || 0) })}
                      className="h-8 text-xs bg-card tabular-nums text-right"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={lines.length <= 1}
                      onClick={() => removeLine(index)}
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

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!activeInvoice || !reason.trim() || computedTotals.total <= 0 || isExceedingCeiling || isSubmitting}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isSubmitting ? "Émission..." : "Émettre l'avoir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

