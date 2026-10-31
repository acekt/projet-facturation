"use client"

import * as React from "react"
import { RefreshCcw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { createCreditNote, getCreditNotes } from "@/app/actions/credit-note.actions"
import { getInvoices } from "@/app/actions/invoice.actions"
import { computeTotals } from "@/lib/math-logic"
import { useStore, type Invoice, type CreditNote } from "@/lib/store"
import { INVOICE_STATUS } from "@/lib/constants"
import { toast } from "sonner"
import { CreditNoteSuccessView } from "./CreditNoteSuccessView"
import { CreditNoteFormBody, type CreditLineDraft } from "./CreditNoteFormBody"

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
  initialInvoice,
  invoices,
  creditNotes,
  onSuccess,
}: CreateCreditNoteModalProps) {
  const setInvoices = useStore((state) => state.setInvoices)
  const setCreditNotes = useStore((state) => state.setCreditNotes)
  const settings = useStore((state) => state.settings)

  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState<string>("")
  const [reason, setReason] = React.useState<string>("")
  const [lines, setLines] = React.useState<CreditLineDraft[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [createdSummary, setCreatedSummary] = React.useState<{
    noteNumber: string
    clientName: string
    invoiceNumber: string
    amount: number
    newBalance: number
  } | null>(null)

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

  const initLinesFromInvoice = React.useCallback((invoice: Invoice) => {
    if (invoice.items && invoice.items.length > 0) {
      setLines(
        invoice.items.map((it, idx) => ({
          id: String(idx + 1),
          description: it.description,
          quantity: it.quantity,
          unitPrice: Math.round(it.unitPrice),
        }))
      )
    } else {
      setLines([
        {
          id: "1",
          description: `Avoir sur facture ${invoice.number}`,
          quantity: 1,
          unitPrice: Math.round(invoice.subtotal || invoice.total),
        },
      ])
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      setCreatedSummary(null)
      if (initialInvoice) {
        setSelectedInvoiceId(initialInvoice.id)
        setReason(`Avoir rectificatif / remboursement sur facture ${initialInvoice.number}`)
        initLinesFromInvoice(initialInvoice)
      } else {
        setSelectedInvoiceId("")
        setReason("")
        setLines([])
      }
    }
  }, [open, initialInvoice, initLinesFromInvoice])

  const handleInvoiceSelect = (invId: string) => {
    setSelectedInvoiceId(invId)
    const target = eligibleInvoices.find((inv) => inv.id === invId)
    if (target) {
      setReason(`Avoir rectificatif sur facture ${target.number}`)
      initLinesFromInvoice(target)
    }
  }

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: String(Date.now()), description: "", quantity: 1, unitPrice: 0 },
    ])
  }

  const updateLine = (index: number, patch: Partial<CreditLineDraft>) => {
    setLines((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], ...patch }
      return copy
    })
  }

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== index))
  }

  const computedTotals = React.useMemo(() => {
    return computeTotals(
      lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice })),
      0,
      {
        tvaRate: settings.tvaRate ?? 0,
        tpsRate: settings.tpsRate ?? 9.5,
        cssRate: settings.cssRate ?? 0,
      }
    )
  }, [lines, settings])

  const isExceedingCeiling = computedTotals.total > maxRefundableTtc

  const handleSubmit = async () => {
    if (!activeInvoice) {
      toast.error("Veuillez sélectionner une facture valide")
      return
    }

    if (!reason.trim()) {
      toast.error("Veuillez renseigner un motif légal pour cet avoir")
      return
    }

    const validItems = lines
      .filter((l) => l.description.trim() && l.quantity > 0 && l.unitPrice > 0)
      .map((l) => ({
        description: l.description.trim(),
        quantity: l.quantity,
        unitPrice: Math.round(l.unitPrice),
      }))

    if (validItems.length === 0) {
      toast.error("Veuillez renseigner au moins une ligne valide avec montant positif")
      return
    }

    if (computedTotals.total <= 0) {
      toast.error("Le montant total de l'avoir doit être supérieur à zéro")
      return
    }

    if (isExceedingCeiling) {
      toast.error(
        `Le total (${computedTotals.total} FCFA) dépasse le plafond de la facture (${maxRefundableTtc} FCFA)`
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

      const createdObj = res.data
      setCreatedSummary({
        noteNumber: createdObj?.number || "AV-000",
        clientName: activeInvoice.clientName,
        invoiceNumber: activeInvoice.number,
        amount: computedTotals.total,
        newBalance: Math.max(0, maxRefundableTtc - computedTotals.total),
      })
      toast.success(`Avoir ${createdObj?.number || ""} émis avec succès`)
      onSuccess?.()
    } catch {
      toast.error("Erreur lors de la création de l'avoir")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setCreatedSummary(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setCreatedSummary(null); onOpenChange(v); }}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        {createdSummary ? (
          <CreditNoteSuccessView
            noteNumber={createdSummary.noteNumber}
            clientName={createdSummary.clientName}
            invoiceNumber={createdSummary.invoiceNumber}
            amount={createdSummary.amount}
            newBalance={createdSummary.newBalance}
            onClose={handleClose}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <RefreshCcw className="w-5 h-5 text-orange-600" />
                Émettre un avoir / remboursement (Note de crédit OHADA)
              </DialogTitle>
              <DialogDescription>
                Créez un avoir partiel ou total pour enregistrer un remboursement client ou rectifier une facture existante.
              </DialogDescription>
            </DialogHeader>

            <CreditNoteFormBody
              initialInvoice={initialInvoice}
              activeInvoice={activeInvoice}
              eligibleInvoices={eligibleInvoices}
              selectedInvoiceId={selectedInvoiceId}
              onInvoiceSelect={handleInvoiceSelect}
              maxRefundableTtc={maxRefundableTtc}
              reason={reason}
              onReasonChange={setReason}
              lines={lines}
              onUpdateLine={updateLine}
              onAddLine={addLine}
              onRemoveLine={removeLine}
              computedTotals={computedTotals}
              settings={settings}
              isExceedingCeiling={isExceedingCeiling}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
