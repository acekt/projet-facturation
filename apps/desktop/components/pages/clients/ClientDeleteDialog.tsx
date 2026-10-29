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

interface ClientDeleteDialogProps {
  clientId: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => Promise<void>;
  isSubmitting: boolean;
}

export function ClientDeleteDialog({
  clientId,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: ClientDeleteDialogProps) {
  return (
    <AlertDialog open={clientId !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">Confirmer la suppression</AlertDialogTitle>
          <AlertDialogDescription>
            Êtes-vous sûr de vouloir supprimer ce client ? Cette action appliquera un Soft Delete pour conserver l'historique de facturation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => clientId && onConfirm(clientId)}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            disabled={isSubmitting}
          >
            {isSubmitting ? "En cours..." : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
