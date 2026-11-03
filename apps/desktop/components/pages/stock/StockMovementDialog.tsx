"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { toast } from "sonner";
import { recordStockMovement } from "@/app/actions/stock.actions";

interface StockMovementDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: string | null;
  serviceName: string;
  type: "INVENTORY_IN" | "INVENTORY_OUT" | null;
  onSuccess: () => void;
}

export function StockMovementDialog({
  isOpen,
  onOpenChange,
  serviceId,
  serviceName,
  type,
  onSuccess
}: StockMovementDialogProps) {
  const [quantity, setQuantity] = React.useState<number>(1);
  const [notes, setNotes] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const isEntry = type === "INVENTORY_IN";

  React.useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setNotes("");
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId || !type) return;

    if (quantity <= 0) {
      toast.error("La quantité doit être supérieure à zéro");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await recordStockMovement({
        serviceId,
        type,
        quantity,
        notes
      });
      if (res.success) {
        toast.success(`Mouvement de stock enregistré`);
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(res.error || "Erreur lors de l'enregistrement");
      }
    } catch (e) {
      toast.error("Erreur inattendue");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEntry ? "Entrée de stock" : "Sortie de stock"} - {serviceName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-muted-foreground">
              Quantité à {isEntry ? "ajouter" : "retirer"} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              className="bg-secondary border-border"
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-muted-foreground">
              Motif / Notes
            </Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Réapprovisionnement, Perte, etc."
              className="bg-secondary border-border"
              disabled={isSubmitting}
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-4"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enregistrement..." : "Confirmer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
