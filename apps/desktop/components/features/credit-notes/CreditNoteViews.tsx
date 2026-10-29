"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  FileText,
  Download,
  RefreshCcw,
  MoreVertical,
  Eye,
} from "lucide-react"
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
import { formatCurrency, formatDate } from "@/lib/utils"

export interface InvoiceStatusInfo {
  status: Invoice["status"]
  total: number
  paidAmount: number
  remainingAmount: number
  dueDate?: string
}

interface CreditNoteViewsProps {
  creditNotes: CreditNote[]
  viewFormat: string
  isDownloading: string | null
  getInvoiceStatusInfo: (invoiceId: string) => InvoiceStatusInfo | null
  onPreview: (note: CreditNote) => void
  onDownloadPDF: (note: CreditNote) => void
}

export function CreditNoteViews({
  creditNotes,
  viewFormat,
  isDownloading,
  getInvoiceStatusInfo,
  onPreview,
  onDownloadPDF,
}: CreditNoteViewsProps) {
  if (viewFormat === "table") {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-muted-foreground uppercase text-[11px] font-semibold sticky top-0 z-10 border-b border-border">
              <tr>
                <th className="px-6 py-3.5">Numéro</th>
                <th className="px-6 py-3.5">Facture liée</th>
                <th className="px-6 py-3.5">Client</th>
                <th className="px-6 py-3.5">Statut Facture</th>
                <th className="px-6 py-3.5 text-right">Montant</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {creditNotes.map((note) => {
                const invoiceInfo = getInvoiceStatusInfo(note.invoiceId)
                return (
                  <tr key={note.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-foreground whitespace-nowrap">
                      {note.number}
                    </td>
                    <td className="px-6 py-4 font-mono text-muted-foreground text-xs whitespace-nowrap">
                      {note.invoiceId}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">{note.clientName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {invoiceInfo ? (
                        <StatusBadge
                          variant={getInvoiceStatusVariant(invoiceInfo)}
                          amount={invoiceInfo.status === "PAID" ? invoiceInfo.total : undefined}
                          paidAmount={invoiceInfo.paidAmount}
                          remainingAmount={invoiceInfo.remainingAmount}
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap font-medium text-primary tabular-nums">
                      {formatCurrency(note.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatDate(note.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                          onClick={() => onPreview(note)}
                        >
                          <Eye className="w-4 h-4 mr-1.5" />
                          Aperçu
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                          onClick={() => onDownloadPDF(note)}
                          disabled={isDownloading === note.id}
                        >
                          <Download className="w-4 h-4 mr-1.5" />
                          PDF
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {creditNotes.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            Aucun avoir émis.
          </div>
        )}
      </div>
    )
  }

  if (viewFormat === "horizontal") {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        <div className="grid grid-cols-1 gap-4">
          {creditNotes.length > 0 ? (
            creditNotes.map((note, index) => {
              const invoiceInfo = getInvoiceStatusInfo(note.invoiceId)
              return (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Card className="bg-card border-border hover:border-orange-200 transition-all group shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center text-orange-600">
                            <RefreshCcw className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-mono font-bold text-foreground text-lg">{note.number}</h3>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 cursor-pointer"
                            onClick={() => onPreview(note)}
                          >
                            <Eye className="w-4 h-4" />
                            Aperçu
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 cursor-pointer"
                            onClick={() => onDownloadPDF(note)}
                            disabled={isDownloading === note.id}
                          >
                            <Download className="w-4 h-4" />
                            {isDownloading === note.id ? "..." : "PDF"}
                          </Button>
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
    )
  }

  // Grid / Cards view
  return (
    <div className="flex-1 overflow-y-auto min-h-0 pr-1">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {creditNotes.length > 0 ? (
          creditNotes.map((note, index) => {
            const invoiceInfo = getInvoiceStatusInfo(note.invoiceId)
            return (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className="bg-card border-border hover:border-orange-200 transition-all group shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center text-orange-600 group-hover:bg-orange-200 transition-colors">
                        <RefreshCcw className="w-5 h-5" />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground cursor-pointer">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onPreview(note)}>
                            <Eye className="w-4 h-4" />
                            Aperçu A4
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => onDownloadPDF(note)}
                            disabled={isDownloading === note.id}
                          >
                            <Download className="w-4 h-4" />
                            {isDownloading === note.id ? "Génération..." : "Télécharger PDF"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-mono font-bold text-sm">{note.number}</h3>
                      {invoiceInfo && (
                        <StatusBadge
                          variant={getInvoiceStatusVariant(invoiceInfo)}
                          amount={invoiceInfo.status === "PAID" ? invoiceInfo.total : undefined}
                          paidAmount={invoiceInfo.paidAmount}
                          remainingAmount={invoiceInfo.remainingAmount}
                        />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{note.clientName}</p>
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <FileText className="w-3 h-3" />
                        <span className="tabular-nums">Date: {formatDate(note.date)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <p className="text-lg font-semibold text-foreground tracking-tighter tabular-nums">
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
  )
}

