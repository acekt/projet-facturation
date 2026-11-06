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
  RefreshCcw,
  FileText,
  User,
  Calendar,
  CheckCircle2,
  Eye,
  Download,
  AlertCircle,
  PackageCheck,
  Receipt,
} from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { resolveCreditNoteInvoiceNumber } from "@/lib/utils/excel-export";
import type { CreditNote, Invoice } from "@/lib/store";
import { getCreditNoteNatureInfo, type InvoiceStatusInfo } from "./CreditNoteViews";

interface CreditNoteDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  creditNote: CreditNote | null;
  invoice?: Invoice | null;
  invoiceStatusInfo?: InvoiceStatusInfo | null;
  onOpenPreview: (note: CreditNote) => void;
  onDownloadPDF?: (note: CreditNote) => void;
}

export function CreditNoteDetailsDialog({
  isOpen,
  onOpenChange,
  creditNote,
  invoice,
  invoiceStatusInfo,
  onOpenPreview,
  onDownloadPDF,
}: CreditNoteDetailsDialogProps) {
  if (!creditNote) return null;

  const items = creditNote.items || [];
  const relatedInvoiceNumber = resolveCreditNoteInvoiceNumber(
    creditNote,
    invoice ? [invoice] : undefined,
    invoiceStatusInfo
  );
  const nature = getCreditNoteNatureInfo(creditNote, invoiceStatusInfo);
  const totalTaxes = (creditNote.tvaAmount || 0) + (creditNote.cssAmount || 0) + (creditNote.tpsAmount || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
                <RefreshCcw className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-foreground text-base font-bold flex items-center gap-2">
                  <span>Avoir {creditNote.number}</span>
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={cn("font-semibold text-xs border", nature.badgeClass)}>
                    {nature.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">• Émis le {formatDate(creditNote.date)}</span>
                </div>
              </div>
            </div>
          </div>
          <VisuallyHidden>
            <DialogDescription>
              Fiche détaillée des informations de l'avoir {creditNote.number}
            </DialogDescription>
          </VisuallyHidden>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Synthèse Financière Card */}
          <div className="p-4 rounded-xl bg-secondary/40 border border-border/60">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                  Montant Avoir (TTC)
                </span>
                <p className="text-base font-extrabold text-orange-600 dark:text-orange-400 tabular-nums mt-0.5">
                  {formatCurrency(creditNote.total)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sous-total HT
                </span>
                <p className="text-base font-extrabold text-foreground tabular-nums mt-0.5">
                  {formatCurrency(creditNote.subtotal)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  TVA & Taxes
                </span>
                <p className="text-base font-extrabold text-foreground tabular-nums mt-0.5">
                  {formatCurrency(totalTaxes)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Nouveau reste facture
                </span>
                <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                  {invoiceStatusInfo ? formatCurrency(invoiceStatusInfo.remainingAmount) : "0 FCFA"}
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
                <span className="text-muted-foreground">Sous-total HT :</span>{" "}
                <span className="font-semibold text-foreground tabular-nums">{formatCurrency(creditNote.subtotal)}</span>
              </div>
              {Boolean(creditNote.cssAmount && creditNote.cssAmount > 0) && (
                <div>
                  <span className="text-muted-foreground">CSS (1%) :</span>{" "}
                  <span className="font-semibold text-foreground tabular-nums">{formatCurrency(creditNote.cssAmount)}</span>
                </div>
              )}
              {Boolean(creditNote.tpsAmount && creditNote.tpsAmount > 0) && (
                <div>
                  <span className="text-muted-foreground">TPS (9.5%) :</span>{" "}
                  <span className="font-semibold text-foreground tabular-nums">{formatCurrency(creditNote.tpsAmount || 0)}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">TVA (18%) :</span>{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {creditNote.tvaAmount > 0 ? formatCurrency(creditNote.tvaAmount) : "0 FCFA (Exonéré)"}
                </span>
              </div>
            </div>
          </div>

          {/* Grille Métadonnées : Facture liée & Client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-secondary/20 border border-border/50 space-y-1.5">
              <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-primary" /> Facture liée
              </span>
              <p className="font-semibold text-foreground font-mono text-sm">{relatedInvoiceNumber}</p>
              {invoice && (
                <p className="text-muted-foreground">
                  Montant initial de la facture : <span className="font-medium text-foreground">{formatCurrency(invoice.total)}</span>
                </p>
              )}
              {invoiceStatusInfo && (
                <div className="text-[11px] text-muted-foreground pt-0.5">
                  Statut actuel : <span className="font-medium text-foreground">{invoiceStatusInfo.status}</span>
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-secondary/20 border border-border/50 space-y-1.5">
              <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" /> Client & Motif
              </span>
              <p className="font-semibold text-foreground text-sm">{creditNote.clientName || "Client non renseigné"}</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                <span className="font-medium text-foreground">Motif :</span> {creditNote.reason || "Correction commerciale / Remboursement"}
              </p>
            </div>
          </div>

          {/* Notification d'impact opérationnel différencié */}
          {nature.type === "refund" && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Remboursement Effectif au Client (Décaissement de trésorerie)</p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  La facture d&apos;origine ayant déjà été acquittée par le client, cet avoir a généré un trop-perçu restitué au client. Les articles suivis ont été réintégrés à l&apos;inventaire.
                </p>
              </div>
            </div>
          )}

          {nature.type === "credit_balance" && (
            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-800 dark:text-indigo-300 text-xs flex items-start gap-2.5">
              <PackageCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Avoir à Valoir / Crédit Client (Report d&apos;avance)</p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  Le trop-perçu est conservé au crédit du compte client et sera déductible de ses prochains achats. Les articles suivis ont été réintégrés à l&apos;inventaire.
                </p>
              </div>
            </div>
          )}

          {nature.type === "deduction" && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-xs flex items-start gap-2.5">
              <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Avoir d&apos;Imputation (Déduction sur créance client)</p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  Cet avoir a été déduit du solde restant dû sur la facture. Aucun décaissement de trésorerie n&apos;a eu lieu car la facture était impayée. Les articles suivis ont été réintégrés à l&apos;inventaire.
                </p>
              </div>
            </div>
          )}

          {/* Lignes d'articles crédités */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Articles retournés / crédités ({items.length})
            </span>
            <div className="border border-border/60 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40 text-muted-foreground border-b border-border/60 text-[10px] uppercase font-semibold">
                  <tr>
                    <th className="px-3 py-2 text-left">Désignation</th>
                    <th className="px-3 py-2 text-center">Quantité</th>
                    <th className="px-3 py-2 text-right">Prix Unitaire</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-secondary/20">
                      <td className="px-3 py-2 font-medium text-foreground">{it.description}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{it.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatCurrency(it.unitPrice)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground">
                        {formatCurrency(it.total || it.quantity * it.unitPrice)}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground italic">
                        Aucun détail d'article spécifié sur cet avoir.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer avec actions rapides */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 pt-3 border-t border-border/60 mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto cursor-pointer"
          >
            Fermer
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onDownloadPDF && (
              <Button
                variant="outline"
                className="gap-2 w-full sm:w-auto cursor-pointer"
                onClick={() => onDownloadPDF(creditNote)}
              >
                <Download className="w-4 h-4 text-muted-foreground" />
                Télécharger PDF
              </Button>
            )}
            <Button
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm w-full sm:w-auto cursor-pointer"
              onClick={() => {
                onOpenChange(false);
                onOpenPreview(creditNote);
              }}
            >
              <Eye className="w-4 h-4" />
              Ouvrir l'aperçu A4
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

