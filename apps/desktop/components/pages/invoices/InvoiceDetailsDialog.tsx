"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog";
import { VisuallyHidden } from "@workspace/ui/components/visually-hidden";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  FileText,
  User,
  Calendar,
  CreditCard,
  RotateCcw,
  CheckCircle2,
  Clock,
  Printer,
  Eye,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Receipt,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getPaymentBadge, getPaymentStatus } from "./InvoiceViews";
import type { Invoice, CreditNote } from "@/lib/store";

interface InvoiceDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  creditNotes?: CreditNote[];
  onOpenPreview: (invoice: Invoice) => void;
  onRecordPayment?: (invoice: Invoice) => void;
}

export function InvoiceDetailsDialog({
  isOpen,
  onOpenChange,
  invoice,
  creditNotes,
  onOpenPreview,
  onRecordPayment,
}: InvoiceDetailsDialogProps) {
  if (!invoice) return null;

  const paymentStatus = getPaymentStatus(invoice, creditNotes);
  const totalPaid = paymentStatus.paid;
  const totalCredited = paymentStatus.credited;
  const remaining = paymentStatus.remaining;

  const invoiceCreditNotes = (creditNotes || []).filter(
    (cn) => cn.invoiceId === invoice.id && !cn.deletedAt
  );

  const payments = invoice.payments || [];
  const items = invoice.items || [];
  const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < new Date() && remaining > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-foreground text-base font-bold flex items-center gap-2">
                  <span>Facture {invoice.number}</span>
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  {getPaymentBadge(invoice, creditNotes)}
                  <span className="text-xs text-muted-foreground">• Émise le {formatDate(invoice.date)}</span>
                </div>
              </div>
            </div>
          </div>
          <VisuallyHidden>
            <DialogDescription>
              Fiche détaillée des informations de gestion et règlements de la facture {invoice.number}
            </DialogDescription>
          </VisuallyHidden>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Synthèse Financière Card */}
          <div className="p-4 rounded-xl bg-secondary/40 border border-border/60">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total TTC
                </span>
                <p className="text-base font-extrabold text-foreground tabular-nums mt-0.5">
                  {formatCurrency(invoice.total)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Encaissé
                </span>
                <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                  {formatCurrency(totalPaid)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                  Avoirs déduits
                </span>
                <p className="text-base font-extrabold text-orange-600 dark:text-orange-400 tabular-nums mt-0.5">
                  {formatCurrency(totalCredited)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Reste à payer
                </span>
                <p
                  className={`text-base font-extrabold tabular-nums mt-0.5 ${
                    remaining === 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : isOverdue
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-foreground"
                  }`}
                >
                  {formatCurrency(remaining)}
                </p>
              </div>
            </div>
          </div>

          {/* Décomposition Fiscale & Taxes (Norme DGI Gabon) */}
          <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/50 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-primary" /> Décomposition Fiscale & Taxes (Norme DGI Gabon)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Brut HT :</span>{" "}
                <span className="font-semibold text-foreground tabular-nums">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {Boolean(invoice.discount && invoice.discount > 0) && (
                <div>
                  <span className="text-muted-foreground">Remise :</span>{" "}
                  <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">−{formatCurrency(invoice.discount)}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Net HT :</span>{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {formatCurrency(Math.max(0, invoice.subtotal - (invoice.discount || 0)))}
                </span>
              </div>
              {invoice.cssAmount > 0 && (
                <div>
                  <span className="text-muted-foreground">CSS (1%) :</span>{" "}
                  <span className="font-semibold text-foreground tabular-nums">{formatCurrency(invoice.cssAmount)}</span>
                </div>
              )}
              {Boolean(invoice.tpsAmount && invoice.tpsAmount > 0) && (
                <div>
                  <span className="text-muted-foreground">TPS (9.5%) :</span>{" "}
                  <span className="font-semibold text-foreground tabular-nums">{formatCurrency(invoice.tpsAmount || 0)}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">TVA (18%) :</span>{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {invoice.tvaAmount > 0 ? formatCurrency(invoice.tvaAmount) : "0 FCFA (Exonéré)"}
                </span>
              </div>
            </div>
          </div>

          {/* Grille Métadonnées Client & Échéance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-secondary/20 border border-border/50 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <User className="w-3.5 h-3.5 text-primary" /> Client facturé
              </div>
              <p className="text-foreground font-semibold text-sm truncate" title={invoice.clientName}>
                {invoice.clientName || "Client Comptoir"}
              </p>
              {invoice.clientEmail && (
                <p className="text-muted-foreground text-[11px] truncate">{invoice.clientEmail}</p>
              )}
            </div>

            <div className="p-3 rounded-lg bg-secondary/20 border border-border/50 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <Calendar className="w-3.5 h-3.5 text-primary" /> Date d'échéance
              </div>
              <p className="text-foreground font-semibold text-sm tabular-nums">
                {invoice.dueDate ? formatDate(invoice.dueDate) : "Paiement à réception"}
              </p>
              {isOverdue && (
                <p className="text-rose-600 dark:text-rose-400 font-semibold text-[11px] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Facture échue non soldée
                </p>
              )}
            </div>
          </div>

          {/* Historique des Règlements */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                Règlements encaissés ({payments.length})
              </span>
              {remaining > 0 && onRecordPayment && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onRecordPayment(invoice);
                  }}
                  className="text-primary hover:underline font-semibold cursor-pointer"
                >
                  + Enregistrer un paiement
                </button>
              )}
            </div>

            {payments.length > 0 ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Mode</th>
                      <th className="px-3 py-2 text-left font-medium">Référence</th>
                      <th className="px-3 py-2 text-right font-medium">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 tabular-nums">{p.date ? formatDate(p.date) : "—"}</td>
                        <td className="px-3 py-2">{p.paymentMethod}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{p.reference || "—"}</td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          +{formatCurrency(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3 text-center rounded-lg bg-secondary/20 border border-border/50 text-xs text-muted-foreground">
                Aucun règlement enregistré pour le moment.
              </div>
            )}
          </div>

          {/* Avoirs rattachés si existants */}
          {invoiceCreditNotes.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-orange-600" /> Avoirs et remboursements imputés ({invoiceCreditNotes.length})
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Avoir N°</th>
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-right font-medium">Montant imputé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoiceCreditNotes.map((cn) => (
                      <tr key={cn.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-mono font-medium">{cn.number}</td>
                        <td className="px-3 py-2 tabular-nums">{cn.date ? formatDate(cn.date) : "—"}</td>
                        <td className="px-3 py-2 text-right font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                          -{formatCurrency(cn.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Articles & Lignes */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" /> Lignes de facturation ({items.length})
            </div>
            <div className="rounded-lg border border-border overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Désignation</th>
                    <th className="px-3 py-2 text-center font-medium w-16">Qté</th>
                    <th className="px-3 py-2 text-right font-medium w-28">P.U HT</th>
                    <th className="px-3 py-2 text-right font-medium w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{item.description}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{item.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border mt-2">
          <Button
            variant="default"
            size="sm"
            className="gap-2 cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => {
              onOpenChange(false);
              onOpenPreview(invoice);
            }}
          >
            <Eye className="w-4 h-4" />
            Ouvrir l'aperçu A4 (Imprimer / PDF)
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

