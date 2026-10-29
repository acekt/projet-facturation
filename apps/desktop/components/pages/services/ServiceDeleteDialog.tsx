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

interface ServiceDeleteDialogProps {
  serviceId: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => Promise<void>;
  isSubmitting: boolean;
}

export function ServiceDeleteDialog({
  serviceId,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: ServiceDeleteDialogProps) {
  return (
    <AlertDialog open={serviceId !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">Confirmer la suppression</AlertDialogTitle>
          <AlertDialogDescription>
            Êtes-vous sûr de vouloir supprimer ce service du catalogue ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => serviceId && onConfirm(serviceId)}
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
