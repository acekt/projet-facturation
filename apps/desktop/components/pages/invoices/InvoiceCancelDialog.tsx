"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import type { Invoice } from "@/lib/store";

interface InvoiceCancelDialogProps {
  invoice: Invoice | null;
  onOpenChange: (open: boolean) => void;
  deleteAssociatedQuote: boolean;
  onDeleteAssociatedQuoteChange: (val: boolean) => void;
  onConfirm: () => Promise<void>;
  isCancelling: boolean;
}

export function InvoiceCancelDialog({
  invoice,
  onOpenChange,
  deleteAssociatedQuote,
  onDeleteAssociatedQuoteChange,
  onConfirm,
  isCancelling,
}: InvoiceCancelDialogProps) {
  return (
    <AlertDialog open={invoice !== null} onOpenChange={(open) => !open && !isCancelling && onOpenChange(false)}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">
            Annuler la facture {invoice?.number}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <span>
              Cette action va générer un avoir pour annuler comptablement cette facture.
            </span>
            {invoice?.quoteId && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border mt-3">
                <div className="space-y-0.5 text-left">
                  <Label className="text-sm font-medium">Supprimer également le devis associé</Label>
                  <p className="text-[10px] text-muted-foreground">Le devis lié sera également marqué comme supprimé</p>
                </div>
                <Switch
                  checked={deleteAssociatedQuote}
                  onCheckedChange={onDeleteAssociatedQuoteChange}
                  disabled={isCancelling}
                />
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCancelling}>Retour</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isCancelling}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isCancelling ? "Annulation..." : "Confirmer l'annulation"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
