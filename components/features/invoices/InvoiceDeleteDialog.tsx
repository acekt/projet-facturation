import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface InvoiceDeleteDialogProps {
  invoiceId: string | null;
  hasAssociatedQuote: boolean;
  onClose: () => void;
  onConfirm: (deleteQuote: boolean) => void;
  isDeleting: boolean;
  deleteAssociatedQuote: boolean;
  setDeleteAssociatedQuote: (value: boolean) => void;
}

export function InvoiceDeleteDialog({
  invoiceId,
  hasAssociatedQuote,
  onClose,
  onConfirm,
  isDeleting,
  deleteAssociatedQuote,
  setDeleteAssociatedQuote
}: InvoiceDeleteDialogProps) {
  return (
    <AlertDialog open={!!invoiceId} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. La facture sera marquée comme annulée.
            Toutes les transactions et paiements associés seront également annulés.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {hasAssociatedQuote && (
          <div className="flex items-start space-x-2 my-4 p-4 bg-muted/50 rounded-lg">
            <Checkbox
              id="delete-quote"
              checked={deleteAssociatedQuote}
              onCheckedChange={(checked) => setDeleteAssociatedQuote(checked as boolean)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="delete-quote" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Supprimer également le devis associé
              </Label>
              <p className="text-sm text-muted-foreground">
                Si coché, le devis original sera également supprimé. Sinon, il repassera au statut "En attente".
              </p>
            </div>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm(deleteAssociatedQuote);
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
          >
            {isDeleting ? "Suppression..." : "Supprimer la facture"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
