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
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { CreationSuccessModal } from "@/components/features/common/CreationSuccessModal"
import { CreditNoteFormBody, type CreditLineDraft } from "./CreditNoteFormBody"

interface CreateCreditNoteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialInvoice?: Invoice | null
  invoices: Invoice[]
  creditNotes: CreditNote[]
  onSuccess?: () => void
  onPreview?: (creditNote: CreditNote) => void
}

export function CreateCreditNoteModal({
  open,
  onOpenChange,
  initialInvoice,
  invoices,
  creditNotes,
  onSuccess,
  onPreview,
}: CreateCreditNoteModalProps) {
  const setInvoices = useStore((state) => state.setInvoices)
  const setCreditNotes = useStore((state) => state.setCreditNotes)
  const settings = useStore((state) => state.settings)

  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState<string>("")
  const [reason, setReason] = React.useState<string>("")
  const [lines, setLines] = React.useState<CreditLineDraft[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const submitLockRef = React.useRef(false)
  const [applyCss, setApplyCss] = React.useState<boolean>(true)
  const [applyTps, setApplyTps] = React.useState<boolean>(false)
  const [applyTva, setApplyTva] = React.useState<boolean>(true)
  const [createdSummary, setCreatedSummary] = React.useState<{
    noteNumber: string
    clientName: string
    invoiceNumber: string
    amount: number
    newBalance: number
    createdNote?: CreditNote
  } | null>(null)

  const eligibleInvoices = React.useMemo(() => {
    return invoices.filter((inv) => {
      if (inv.status === INVOICE_STATUS.CANCELLED || (inv.status as string) === "draft") return false
      const credited = creditNotes
        .filter((cn) => cn.invoiceId === inv.id && cn.status !== "cancelled" && !cn.deletedAt)
        .reduce((sum, cn) => sum + Math.round(cn.total || 0), 0)
      return Math.round(inv.total) - credited > 0
    })
  }, [invoices, creditNotes])

  const activeInvoice = React.useMemo(() => {
    if (initialInvoice) return initialInvoice
    return eligibleInvoices.find((inv) => inv.id === selectedInvoiceId) || null
  }, [initialInvoice, eligibleInvoices, selectedInvoiceId])

  const alreadyCreditedTotal = React.useMemo(() => {
    if (!activeInvoice) return 0
    return creditNotes
      .filter((cn) => cn.invoiceId === activeInvoice.id && cn.status !== "cancelled" && !cn.deletedAt)
      .reduce((sum, cn) => sum + Math.round(cn.total || 0), 0)
  }, [activeInvoice, creditNotes])

  const maxRefundableTtc = React.useMemo(() => {
    if (!activeInvoice) return 0
    return Math.max(0, Math.round(activeInvoice.total) - alreadyCreditedTotal)
  }, [activeInvoice, alreadyCreditedTotal])

  const activeRates = React.useMemo(() => {
    return {
      tvaRate: applyTva ? (settings.tvaRate || 18) : 0,
      tpsRate: applyTps ? (settings.tpsRate || 9.5) : 0,
      cssRate: applyCss ? (settings.cssRate || 1) : 0,
    }
  }, [applyCss, applyTps, applyTva, settings])

  const getHTForTargetTTC = React.useCallback(
    (targetTTC: number, rates: { tvaRate: number; tpsRate: number; cssRate: number }) => {
      if (targetTTC <= 0) return 0
      const taxFactor =
        1 +
        rates.cssRate / 100 +
        (1 + rates.cssRate / 100) * ((rates.tvaRate + rates.tpsRate) / 100)
      let candidateHT = Math.max(1, Math.round(targetTTC / taxFactor))
      let check = computeTotals([{ quantity: 1, unitPrice: candidateHT }], 0, rates)
      while (check.total > targetTTC && candidateHT > 1) {
        candidateHT--
        check = computeTotals([{ quantity: 1, unitPrice: candidateHT }], 0, rates)
      }
      while (check.total < targetTTC) {
        const nextCheck = computeTotals([{ quantity: 1, unitPrice: candidateHT + 1 }], 0, rates)
        if (nextCheck.total <= targetTTC) {
          candidateHT++
          check = nextCheck
        } else {
          break
        }
      }
      return candidateHT
    },
    []
  )

  const initLinesFromInvoice = React.useCallback(
    (invoice: Invoice) => {
      const credited = creditNotes
        .filter((cn) => cn.invoiceId === invoice.id && cn.status !== "cancelled" && !cn.deletedAt)
        .reduce((sum, cn) => sum + Math.round(cn.total || 0), 0)
      const availableCeiling = Math.max(0, Math.round(invoice.total) - credited)

      const invApplyTva = invoice.tvaAmount > 0
      const invApplyTps = Boolean(invoice.tpsAmount && invoice.tpsAmount > 0)
      const invApplyCss = Boolean(invoice.cssAmount && invoice.cssAmount > 0)
      setApplyTva(invApplyTva)
      setApplyTps(invApplyTps)
      setApplyCss(invApplyCss)

      const rates = {
        tvaRate: invApplyTva ? (settings.tvaRate || 18) : 0,
        tpsRate: invApplyTps ? (settings.tpsRate || 9.5) : 0,
        cssRate: invApplyCss ? (settings.cssRate || 1) : 0,
      }

      if (invoice.items && invoice.items.length > 0) {
        const rawLines = invoice.items.map((it, idx) => ({
          id: String(idx + 1),
          description: it.description,
          quantity: it.quantity,
          unitPrice: Math.round(it.unitPrice),
          serviceId: (it as any).serviceId || (it as any).id || null,
        }))

        const initialTotals = computeTotals(
          rawLines.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice })),
          0,
          rates
        )

        if (initialTotals.total > availableCeiling && availableCeiling > 0) {
          const candidateHT = getHTForTargetTTC(availableCeiling, rates)
          setLines([
            {
              id: "1",
              description: `Avoir d'imputation / solde sur facture ${invoice.number}`,
              quantity: 1,
              unitPrice: candidateHT,
              serviceId: null,
            },
          ])
        } else {
          setLines(rawLines)
        }
      } else {
        const candidateHT = getHTForTargetTTC(availableCeiling, rates)
        setLines([
          {
            id: "1",
            description: `Avoir sur facture ${invoice.number}`,
            quantity: 1,
            unitPrice: candidateHT > 0 ? candidateHT : Math.round(invoice.subtotal || invoice.total),
            serviceId: null,
          },
        ])
      }
    },
    [creditNotes, settings, getHTForTargetTTC]
  )

  React.useEffect(() => {
    if (open) {
      setCreatedSummary(null)
      if (initialInvoice) {
        setSelectedInvoiceId(initialInvoice.id)
        const hasPayments = (initialInvoice.payments || []).some((p) => !p.deletedAt && p.amount > 0)
        setReason(
          hasPayments
            ? `Avoir rectificatif avec trop-perçu sur facture ${initialInvoice.number}`
            : `Avoir d'imputation sur facture ${initialInvoice.number}`
        )
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
      const hasPayments = (target.payments || []).some((p) => !p.deletedAt && p.amount > 0)
      setReason(
        hasPayments
          ? `Avoir rectificatif avec trop-perçu sur facture ${target.number}`
          : `Avoir d'imputation sur facture ${target.number}`
      )
      initLinesFromInvoice(target)
    }
  }

  const handleAdjustToRemainingCeiling = () => {
    if (!activeInvoice || maxRefundableTtc <= 0) return
    const candidateHT = getHTForTargetTTC(maxRefundableTtc, activeRates)
    setLines([
      {
        id: String(Date.now()),
        description: `Avoir pour solde restant sur facture ${activeInvoice.number}`,
        quantity: 1,
        unitPrice: candidateHT,
        serviceId: null,
      },
    ])
  }

  const handleRestoreOriginalLines = () => {
    if (!activeInvoice) return
    if (activeInvoice.items && activeInvoice.items.length > 0) {
      setLines(
        activeInvoice.items.map((it, idx) => ({
          id: String(idx + 1),
          description: it.description,
          quantity: it.quantity,
          unitPrice: Math.round(it.unitPrice),
          serviceId: (it as any).serviceId || (it as any).id || null,
        }))
      )
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
      activeRates
    )
  }, [lines, activeRates])

  const isExceedingCeiling = computedTotals.total > maxRefundableTtc

  const handleSubmit = async () => {
    if (isSubmitting || submitLockRef.current) return
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
        serviceId: l.serviceId || null,
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

    submitLockRef.current = true
    setIsSubmitting(true)
    try {
      const res = await createCreditNote({
        invoiceId: activeInvoice.id,
        reason: reason.trim(),
        items: validItems,
        applyCss,
        applyTps,
        applyTva,
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
      void useStore.getState().refreshStockData(true)
      useStore.getState().invalidateLedgerCache()

      const createdObj = res.data
      const fullCreatedNote = updatedNotes.success && updatedNotes.data
        ? updatedNotes.data.find((cn) => cn.id === createdObj?.id) || (createdObj as unknown as CreditNote)
        : (createdObj as unknown as CreditNote)
      setCreatedSummary({
        noteNumber: createdObj?.number || "AV-000",
        clientName: activeInvoice.clientName,
        invoiceNumber: activeInvoice.number,
        amount: computedTotals.total,
        newBalance: Math.max(0, maxRefundableTtc - computedTotals.total),
        createdNote: fullCreatedNote,
      })
      onSuccess?.()
    } catch {
      toast.error("Erreur lors de la création de l'avoir")
    } finally {
      setIsSubmitting(false)
      submitLockRef.current = false
    }
  }

  const handleClose = () => {
    setCreatedSummary(null)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog
        open={open && !createdSummary}
        onOpenChange={(v) => {
          if (!v) handleClose()
        }}
      >
        <DialogContent className="bg-card border-border sm:max-w-[720px] max-h-[90vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="p-6 pb-3 shrink-0 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <RefreshCcw className="w-5 h-5 text-primary" />
              Émettre un avoir (Note de crédit OHADA)
            </DialogTitle>
            <DialogDescription>
              Créez une note de crédit pour déduire une créance ou régulariser un trop-perçu client en cas de facture déjà réglée.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4">
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
              onAdjustToRemaining={handleAdjustToRemainingCeiling}
              onRestoreOriginalLines={handleRestoreOriginalLines}
              computedTotals={computedTotals}
              settings={{
                cssRate: settings.cssRate || 1,
                tpsRate: settings.tpsRate || 9.5,
                tvaRate: settings.tvaRate || 18,
              }}
              applyCss={applyCss}
              onApplyCssChange={setApplyCss}
              applyTps={applyTps}
              onApplyTpsChange={setApplyTps}
              applyTva={applyTva}
              onApplyTvaChange={setApplyTva}
              isExceedingCeiling={isExceedingCeiling}
            />
          </div>

          <div className="p-6 pt-3 shrink-0 border-t border-border bg-muted/20 flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!activeInvoice || !reason.trim() || computedTotals.total <= 0 || isExceedingCeiling || isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSubmitting ? "Émission..." : "Émettre l'avoir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CreationSuccessModal
        isOpen={Boolean(createdSummary)}
        onOpenChange={(isOpenState) => {
          if (!isOpenState) handleClose()
        }}
        title="Note d'avoir émise avec succès"
        subtitle={`L'avoir ${createdSummary?.noteNumber || ""} a été enregistré et le solde de la facture a été mis à jour.`}
        details={[
          {
            label: "Numéro d'avoir généré",
            value: <span className="font-mono font-bold text-foreground">{createdSummary?.noteNumber}</span>,
          },
          { label: "Client bénéficiaire", value: createdSummary?.clientName || "—" },
          {
            label: "Facture d'origine",
            value: <span className="font-mono font-semibold text-foreground">{createdSummary?.invoiceNumber}</span>,
          },
          {
            label: "Montant de l'avoir (TTC)",
            value: formatCurrency(createdSummary?.amount || 0),
            isAmount: true,
          },
          {
            label: "Nouveau solde exigible",
            value: formatCurrency(createdSummary?.newBalance || 0),
            isAmount: true,
          },
        ]}
        onClose={handleClose}
        onPreview={
          onPreview && createdSummary?.createdNote
            ? () => {
                const note = createdSummary.createdNote!
                handleClose()
                onPreview(note)
              }
            : undefined
        }
        previewLabel="Voir l'avoir"
      />
    </>
  )
}
