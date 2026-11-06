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
import {
  FileText,
  User,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  AlertCircle,
  Tag,
  Receipt,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  StatusBadge,
  getQuoteStatusVariant,
} from "@workspace/ui/components/status-badge";
import type { Quote } from "@/lib/store";

interface QuoteDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | null;
  onOpenPreview: (quote: Quote) => void;
  onConvertToInvoice?: (quoteId: string) => void;
}

export function QuoteDetailsDialog({
  isOpen,
  onOpenChange,
  quote,
  onOpenPreview,
  onConvertToInvoice,
}: QuoteDetailsDialogProps) {
  if (!quote) return null;

  const isConverted = quote.status === "CONVERTI";
  const isExpired = quote.status === "EXPIRED" || quote.status === "EXPIRE";
  const items = quote.items || [];

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
                  <span>Devis {quote.number}</span>
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge variant={getQuoteStatusVariant(quote.status as any)} />
                  <span className="text-xs text-muted-foreground">• Émis le {formatDate(quote.date)}</span>
                </div>
              </div>
            </div>
          </div>
          <VisuallyHidden>
            <DialogDescription>
              Fiche détaillée des informations de gestion et de chiffrage du devis {quote.number}
            </DialogDescription>
          </VisuallyHidden>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Synthèse Financière Card */}
          <div className="p-4 rounded-xl bg-secondary/40 border border-border/60">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sous-total Brut HT
                </span>
                <p className="text-base font-extrabold text-foreground tabular-nums mt-0.5">
                  {formatCurrency(quote.subtotal || quote.taxBase || 0)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Remise
                </span>
                <p className="text-base font-extrabold text-muted-foreground tabular-nums mt-0.5">
                  {quote.discount ? `-${formatCurrency(quote.discount)}` : "0 FCFA"}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Net HT
                </span>
                <p className="text-base font-extrabold text-foreground tabular-nums mt-0.5">
                  {formatCurrency(Math.max(0, (quote.subtotal || quote.taxBase || 0) - (quote.discount || 0)))}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Total TTC
                </span>
                <p className="text-base font-extrabold text-primary tabular-nums mt-0.5">
                  {formatCurrency(quote.total)}
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
                <span className="font-semibold text-foreground tabular-nums">{formatCurrency(quote.subtotal || quote.taxBase || 0)}</span>
              </div>
              {Boolean(quote.discount && quote.discount > 0) && (
                <div>
                  <span className="text-muted-foreground">Remise :</span>{" "}
                  <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">−{formatCurrency(quote.discount)}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Net HT :</span>{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {formatCurrency(Math.max(0, (quote.subtotal || quote.taxBase || 0) - (quote.discount || 0)))}
                </span>
              </div>
              {Boolean(quote.cssAmount && quote.cssAmount > 0) && (
                <div>
                  <span className="text-muted-foreground">CSS (1%) :</span>{" "}
                  <span className="font-semibold text-foreground tabular-nums">{formatCurrency(quote.cssAmount)}</span>
                </div>
              )}
              {Boolean(quote.tpsAmount && quote.tpsAmount > 0) && (
                <div>
                  <span className="text-muted-foreground">TPS (9.5%) :</span>{" "}
                  <span className="font-semibold text-foreground tabular-nums">{formatCurrency(quote.tpsAmount || 0)}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">TVA (18%) :</span>{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {quote.tvaAmount > 0 ? formatCurrency(quote.tvaAmount) : "0 FCFA (Exonéré)"}
                </span>
              </div>
            </div>
          </div>

          {/* Grille Métadonnées Client & Validité */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-secondary/20 border border-border/50 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <User className="w-3.5 h-3.5 text-primary" /> Client destinataire
              </div>
              <p className="text-foreground font-semibold text-sm truncate" title={quote.clientName || ""}>
                {quote.clientName || "Client Comptoir"}
              </p>
              {quote.clientEmail && (
                <p className="text-muted-foreground text-[11px] truncate">{quote.clientEmail}</p>
              )}
            </div>

            <div className="p-3 rounded-lg bg-secondary/20 border border-border/50 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <Calendar className="w-3.5 h-3.5 text-primary" /> Validité de l'offre
              </div>
              <p className="text-foreground font-semibold text-sm tabular-nums">
                {quote.validUntil ? formatDate(quote.validUntil) : "Non spécifiée (30 jours)"}
              </p>
              {isExpired && (
                <p className="text-rose-600 dark:text-rose-400 font-semibold text-[11px] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Devis expiré
                </p>
              )}
            </div>
          </div>

          {/* Traçabilité conversion */}
          {isConverted && (
            <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-xs text-emerald-900 dark:text-emerald-300">
                <span className="font-semibold">Devis converti en facture :</span> Ce devis a été accepté par le client et transformé avec succès en facture commerciale.
              </div>
            </div>
          )}

          {/* Articles & Lignes */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" /> Lignes de devis ({items.length})
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
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              className="gap-2 cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => {
                onOpenChange(false);
                onOpenPreview(quote);
              }}
            >
              <Eye className="w-4 h-4" />
              Ouvrir l'aperçu A4 (Imprimer / PDF)
            </Button>

            {!isConverted && !isExpired && onConvertToInvoice && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 cursor-pointer border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => {
                  onOpenChange(false);
                  onConvertToInvoice(quote.id);
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Convertir en facture
              </Button>
            )}
          </div>

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

