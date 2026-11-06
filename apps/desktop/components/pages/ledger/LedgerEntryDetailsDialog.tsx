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
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CreditCard,
  FileText,
  Tag,
  User,
  Hash,
  Shield,
  Trash2,
  Loader2,
} from "lucide-react";
import { getLedgerProofImageAction } from "@/app/actions/ledger.actions";
import type { LedgerEntry } from "@/lib/repositories/LedgerRepository";

interface LedgerEntryDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  entry: LedgerEntry | null;
  onDeleteRequest?: (entry: LedgerEntry) => void;
}

export function LedgerEntryDetailsDialog({
  isOpen,
  onOpenChange,
  entry,
  onDeleteRequest,
}: LedgerEntryDetailsDialogProps) {
  const [resolvedProofImage, setResolvedProofImage] = React.useState<string | null>(null);
  const [isLoadingProof, setIsLoadingProof] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen || !entry) {
      setResolvedProofImage(null);
      setIsLoadingProof(false);
      return;
    }

    if (entry.proofImage) {
      setResolvedProofImage(entry.proofImage);
      return;
    }

    if (entry.hasProofImage) {
      setIsLoadingProof(true);
      getLedgerProofImageAction(entry.id)
        .then((res) => {
          if (res.success && res.data) {
            setResolvedProofImage(res.data);
          }
        })
        .catch(() => {
          // silently ignore
        })
        .finally(() => setIsLoadingProof(false));
    } else {
      setResolvedProofImage(null);
    }
  }, [isOpen, entry]);

  if (!entry) return null;

  const isIncome = entry.type === "IN";
  const formatAmount = (val: number) =>
    new Intl.NumberFormat("fr-FR").format(val) + " FCFA";

  const isLinked = Boolean(entry.linkedInvoiceId || entry.linkedPaymentId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isIncome
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                }`}
              >
                {isIncome ? (
                  <ArrowDownRight className="w-5 h-5" />
                ) : (
                  <ArrowUpRight className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-foreground text-base font-bold truncate">
                  Détails de l'écriture
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    className={
                      isIncome
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none text-xs"
                        : "bg-rose-100 text-rose-800 hover:bg-rose-100 border-none text-xs"
                    }
                  >
                    {isIncome ? "Recette (Entrée)" : "Dépense (Sortie)"}
                  </Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {entry.date}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <VisuallyHidden>
            <DialogDescription>
              Détails complets de l'écriture du livre des comptes
            </DialogDescription>
          </VisuallyHidden>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Card Montant Principal */}
          <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Montant de l'opération
              </div>
              <div
                className={`text-2xl font-extrabold tabular-nums mt-0.5 ${
                  isIncome
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {isIncome ? "+" : "-"} {formatAmount(entry.amount)}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground">Catégorie</span>
              <p className="font-semibold text-foreground text-sm">
                {entry.category}
              </p>
            </div>
          </div>

          {/* Grille d'informations */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-secondary/20 border border-border/50 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <User className="w-3.5 h-3.5" /> Tiers / Bénéficiaire
              </div>
              <p className="text-foreground font-semibold text-sm truncate" title={entry.counterparty || ""}>
                {entry.counterparty || "—"}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-secondary/20 border border-border/50 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <CreditCard className="w-3.5 h-3.5" /> Règlement
              </div>
              <p className="text-foreground font-semibold text-sm truncate">
                {entry.paymentMethod}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-secondary/20 border border-border/50 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <Hash className="w-3.5 h-3.5" /> Référence / Pièce
              </div>
              <p className="text-foreground font-semibold font-mono text-xs truncate" title={entry.reference || ""}>
                {entry.reference || "—"}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-secondary/20 border border-border/50 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <Calendar className="w-3.5 h-3.5" /> Date d'effet
              </div>
              <p className="text-foreground font-semibold text-sm tabular-nums">
                {entry.date}
              </p>
            </div>
          </div>

          {/* Motif / Libellé */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" /> Libellé / Motif de l&apos;écriture
            </div>
            <div className="p-3.5 rounded-lg bg-secondary/20 border border-border/50 text-foreground text-xs leading-relaxed">
              {entry.description || "Aucun libellé précisé."}
            </div>
          </div>

          {/* Pièce justificative (Photo / Reçu) */}
          {(resolvedProofImage || isLoadingProof || Boolean(entry.hasProofImage)) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Pièce justificative jointe
                </span>
                {resolvedProofImage && (
                  <a
                    href={resolvedProofImage}
                    download={`Recu_${entry.reference || entry.id.slice(0, 8)}.png`}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Télécharger l&apos;image
                  </a>
                )}
              </div>
              <div className="rounded-lg border border-border overflow-hidden bg-muted/30 max-h-60 flex items-center justify-center p-2 min-h-[80px]">
                {isLoadingProof ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : resolvedProofImage ? (
                  <img
                    src={resolvedProofImage}
                    alt="Pièce justificative"
                    className="max-h-56 w-auto object-contain rounded"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Aperçu non disponible</span>
                )}
              </div>
            </div>
          )}

          {/* Protection / Traçabilité Facture */}
          {isLinked && (
            <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-900 dark:text-blue-300 leading-normal">
                <span className="font-semibold">Écriture automatique synchronisée :</span> Cette ligne est issue du cycle de facturation ou d'un encaissement client. Elle est protégée contre la suppression manuelle afin de préserver l'intégrité comptable.
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
          {!isLinked && onDeleteRequest ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5 cursor-pointer"
              onClick={() => {
                onOpenChange(false);
                onDeleteRequest(entry);
              }}
            >
              <Trash2 className="w-4 h-4" /> Supprimer cette écriture
            </Button>
          ) : (
            <div />
          )}

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

