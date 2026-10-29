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

interface InvoiceDeleteDialogProps {
  invoiceId: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => Promise<void>;
  isDeleting: boolean;
}

export function InvoiceDeleteDialog({
  invoiceId,
  onOpenChange,
  onConfirm,
  isDeleting,
}: InvoiceDeleteDialogProps) {
  return (
    <AlertDialog open={invoiceId !== null} onOpenChange={(open) => !open && !isDeleting && onOpenChange(false)}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">Confirmer la suppression</AlertDialogTitle>
          <AlertDialogDescription>
            Êtes-vous sûr de vouloir supprimer cette facture ? Cette action appliquera un Soft Delete pour conserver la traçabilité fiscale.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => invoiceId && onConfirm(invoiceId)}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {isDeleting ? "Suppression..." : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
