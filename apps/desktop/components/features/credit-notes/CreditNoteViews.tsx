"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  FileText,
  Download,
  RefreshCcw,
  MoreVertical,
  Eye,
  Info,
  Send,
} from "lucide-react"
import { ShareDocumentModal } from "@/components/features/share/ShareDocumentModal"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { StatusBadge, getInvoiceStatusVariant } from "@workspace/ui/components/status-badge"
import type { CreditNote, Invoice } from "@/lib/store"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { resolveCreditNoteInvoiceNumber } from "@/lib/utils/excel-export"

export interface InvoiceStatusInfo {
  status: Invoice["status"]
  total: number
  paidAmount: number
  remainingAmount: number
  dueDate?: string
  invoiceNumber?: string
}

export interface CreditNoteNatureInfo {
  type: "deduction" | "refund" | "credit_balance"
  label: string
  badgeClass: string
  description: string
}

export type EffectiveCreditNoteCategory = "open" | "applied" | "cancelled"

export function getEffectiveCreditNoteCategory(
  note: CreditNote,
  invoiceInfo?: InvoiceStatusInfo | null
): EffectiveCreditNoteCategory {
  const st = (note.status || "").toLowerCase()
  if (st === "cancelled" || st === "annule") {
    return "cancelled"
  }
  const nature = getCreditNoteNatureInfo(note, invoiceInfo)
  const remaining = (note as any).remainingAmount
  const settlementType = ((note as any).settlementType || "").toUpperCase()
  if (
    st === "applied" ||
    st === "refunded" ||
    settlementType === "IMPUTATION" ||
    nature.type === "deduction" ||
    (nature.type === "refund" && nature.label === "Remboursé au client") ||
    (typeof remaining === "number" && remaining <= 0)
  ) {
    return "applied"
  }
  return "open"
}

export function getCreditNoteNatureInfo(
  note: CreditNote,
  invoiceInfo?: InvoiceStatusInfo | null
): CreditNoteNatureInfo {
  const reason = (note.reason || "").toLowerCase()
  const isExplicitRefund = reason.includes("remboursement") || reason.includes("remboursé")
  const isExplicitCredit = reason.includes("crédit") || reason.includes("valoir") || reason.includes("avance")

  if (isExplicitRefund) {
    return {
      type: "refund",
      label: "Remboursé au client",
      badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
      description: "Restitution de fonds décaissée au client.",
    }
  }

  if (isExplicitCredit) {
    return {
      type: "credit_balance",
      label: "Crédit client (À valoir)",
      badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
      description: "Montant conservé comme crédit sur de futurs achats.",
    }
  }

  if (invoiceInfo && invoiceInfo.paidAmount > 0 && invoiceInfo.remainingAmount === 0) {
    return {
      type: "refund",
      label: "Trop-perçu / Remboursable",
      badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
      description: "Facture déjà réglée créant un trop-perçu pour le client.",
    }
  }

  return {
    type: "deduction",
    label: "Imputé sur facture",
    badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
    description: "Déduit de la créance client (aucun flux monétaire décaissé).",
  }
}

interface CreditNoteViewsProps {
  creditNotes: CreditNote[]
  viewFormat: string
  isDownloading: string | null
  getInvoiceStatusInfo: (invoiceId: string) => InvoiceStatusInfo | null
  onViewDetails: (note: CreditNote) => void
  onPreview: (note: CreditNote) => void
  onDownloadPDF: (note: CreditNote) => void
}

interface CreditNoteActionDropdownProps {
  note: CreditNote
  onViewDetails: (note: CreditNote) => void
  onPreview: (note: CreditNote) => void
  onDownloadPDF: (note: CreditNote) => void
  onShare: (note: CreditNote) => void
  isDownloading: string | null
}

function CreditNoteActionDropdown({
  note,
  onViewDetails,
  onPreview,
  onDownloadPDF,
  onShare,
  isDownloading,
}: CreditNoteActionDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <MoreVertical className="w-4 h-4" />
          <span className="sr-only">Actions de l'avoir</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-card border-border shadow-lg p-1.5 rounded-xl">
        <DropdownMenuItem
          className="gap-2.5 cursor-pointer font-medium"
          onClick={() => onViewDetails(note)}
        >
          <Info className="w-4 h-4 text-primary" /> Voir les détails
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2.5 cursor-pointer"
          onClick={() => onPreview(note)}
        >
          <Eye className="w-4 h-4 text-muted-foreground" /> Aperçu du document (A4)
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2.5 cursor-pointer"
          onClick={() => onDownloadPDF(note)}
          disabled={isDownloading === note.id}
        >
          <Download className="w-4 h-4 text-muted-foreground" />
          {isDownloading === note.id ? "Génération..." : "Télécharger PDF"}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2.5 cursor-pointer"
          onClick={() => onShare(note)}
        >
          <Send className="w-4 h-4 text-primary" /> Partager (WhatsApp / Email)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function CreditNoteViews({
  creditNotes,
  viewFormat,
  isDownloading,
  getInvoiceStatusInfo,
  onViewDetails,
  onPreview,
  onDownloadPDF,
}: CreditNoteViewsProps) {
  const [sharingCreditNote, setSharingCreditNote] = React.useState<CreditNote | null>(null)

  if (viewFormat === "table") {
    return (
      <>
      <div className="flex-1 flex flex-col min-h-0 bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-muted-foreground uppercase text-[11px] font-semibold sticky top-0 z-10 border-b border-border">
              <tr>
                <th className="px-6 py-3.5">Numéro</th>
                <th className="px-6 py-3.5">Client</th>
                <th className="px-6 py-3.5">Facture liée</th>
                <th className="px-6 py-3.5">Statut Avoir</th>
                <th className="px-6 py-3.5">Nouveau solde facture</th>
                <th className="px-6 py-3.5 text-right">Montant Avoir</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {creditNotes.map((note) => {
                const invoiceInfo = getInvoiceStatusInfo(note.invoiceId)
                const nature = getCreditNoteNatureInfo(note, invoiceInfo)
                return (
                  <tr key={note.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-foreground whitespace-nowrap">
                      {note.number}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">{note.clientName}</td>
                    <td className="px-6 py-4 font-mono text-muted-foreground text-xs whitespace-nowrap">
                      {resolveCreditNoteInvoiceNumber(note, undefined, invoiceInfo)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={cn("font-semibold text-xs border", nature.badgeClass)}>
                        {nature.label}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {invoiceInfo ? (
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <span className="text-muted-foreground">Reste :</span>
                          <span className={invoiceInfo.remainingAmount === 0 ? "text-emerald-600 font-semibold" : "text-foreground font-semibold"}>
                            {formatCurrency(invoiceInfo.remainingAmount)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap font-medium text-primary tabular-nums">
                      {formatCurrency(note.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatDate(note.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <CreditNoteActionDropdown
                        note={note}
                        onViewDetails={onViewDetails}
                        onPreview={onPreview}
                        onDownloadPDF={onDownloadPDF}
                        onShare={setSharingCreditNote}
                        isDownloading={isDownloading}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {creditNotes.length === 0 && (
          <div className="py-16 text-center">
            <h3 className="text-base font-semibold text-foreground tracking-tight">
              Aucun avoir émis
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Les notes d&apos;avoir permettent d&apos;annuler ou de rectifier partiellement une facture existante. Créez un avoir depuis le bouton « Nouvel avoir » ou depuis une facture.
            </p>
          </div>
        )}
      </div>
      {sharingCreditNote && (
        <ShareDocumentModal
          open={!!sharingCreditNote}
          onOpenChange={(open) => !open && setSharingCreditNote(null)}
          document={sharingCreditNote}
          type="credit_note"
        />
      )}
      </>
    )
  }

  if (viewFormat === "horizontal") {
    return (
      <>
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        <div className="grid grid-cols-1 gap-4">
          {creditNotes.length > 0 ? (
            creditNotes.map((note, index) => {
              const invoiceInfo = getInvoiceStatusInfo(note.invoiceId)
              const nature = getCreditNoteNatureInfo(note, invoiceInfo)
              return (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Card className="bg-card border border-border hover:border-primary/40 transition-colors group shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center text-orange-600">
                            <RefreshCcw className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-mono font-bold text-foreground text-lg">{note.number}</h3>
                              <Badge className={cn("font-semibold text-[11px] border", nature.badgeClass)}>
                                {nature.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-muted-foreground">
                                Pour {note.clientName} • {formatDate(note.date)}
                              </p>
                              {invoiceInfo && (
                                <StatusBadge
                                  variant={getInvoiceStatusVariant(invoiceInfo)}
                                  amount={invoiceInfo.status === "PAID" ? invoiceInfo.total : undefined}
                                  paidAmount={invoiceInfo.paidAmount}
                                  remainingAmount={invoiceInfo.remainingAmount}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs uppercase tracking-wider font-semibold text-orange-600">
                              Montant Avoir
                            </p>
                            <p className="text-xl font-bold text-foreground tabular-nums">
                              {formatCurrency(note.total)}
                            </p>
                          </div>
                          <CreditNoteActionDropdown
                            note={note}
                            onViewDetails={onViewDetails}
                            onPreview={onPreview}
                            onDownloadPDF={onDownloadPDF}
                            onShare={setSharingCreditNote}
                            isDownloading={isDownloading}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })
          ) : (
            <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
              <h3 className="text-lg font-semibold text-foreground tracking-tight uppercase">
                Aucun avoir émis
              </h3>
              <p className="text-muted-foreground mt-1">
                Créez un avoir depuis le bouton « Nouvel avoir » ou depuis le menu d&apos;une facture.
              </p>
            </div>
          )}
        </div>
      </div>
      {sharingCreditNote && (
        <ShareDocumentModal
          open={!!sharingCreditNote}
          onOpenChange={(open) => !open && setSharingCreditNote(null)}
          document={sharingCreditNote}
          type="credit_note"
        />
      )}
      </>
    )
  }

  // Grid / Cards view
  return (
    <>
    <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {creditNotes.length > 0 ? (
          creditNotes.map((note, index) => {
            const invoiceInfo = getInvoiceStatusInfo(note.invoiceId)
            const nature = getCreditNoteNatureInfo(note, invoiceInfo)
            return (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className="bg-card border border-border hover:border-primary/40 transition-colors group shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center text-orange-600 group-hover:bg-orange-200 transition-colors">
                        <RefreshCcw className="w-5 h-5" />
                      </div>
                      <CreditNoteActionDropdown
                        note={note}
                        onViewDetails={onViewDetails}
                        onPreview={onPreview}
                        onDownloadPDF={onDownloadPDF}
                        onShare={setSharingCreditNote}
                        isDownloading={isDownloading}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-mono font-bold text-sm">{note.number}</h3>
                      <Badge className={cn("font-semibold text-[10px] border", nature.badgeClass)}>
                        {nature.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{note.clientName}</p>
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <FileText className="w-3 h-3" />
                        <span className="tabular-nums">Date : {formatDate(note.date)}</span>
                      </div>
                      {invoiceInfo?.invoiceNumber && (
                        <div className="flex items-center justify-between text-[11px] bg-secondary/50 p-1.5 rounded-lg border border-border/40">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            Facture {invoiceInfo.invoiceNumber}
                          </span>
                          <span className="text-[10px] font-semibold text-foreground">
                            Solde restant : {formatCurrency(invoiceInfo.remainingAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <p className="text-lg font-semibold text-foreground tabular-nums">
                        {formatCurrency(note.total)}
                      </p>
                      <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400 text-[10px] px-2 py-0 h-5 border-orange-200">
                        Avoir
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })
        ) : (
          <div className="col-span-full text-center py-20 bg-card rounded-2xl border border-dashed border-border">
            <h3 className="text-lg font-semibold text-foreground tracking-tight uppercase">
              Aucun avoir émis
            </h3>
            <p className="text-muted-foreground mt-1">
              Créez un avoir depuis le bouton « Nouvel avoir » ou depuis le menu d&apos;une facture.
            </p>
          </div>
        )}
      </div>
    </div>
    {sharingCreditNote && (
      <ShareDocumentModal
        open={!!sharingCreditNote}
        onOpenChange={(open) => !open && setSharingCreditNote(null)}
        document={sharingCreditNote}
        type="credit_note"
      />
    )}
    </>
  )
}

