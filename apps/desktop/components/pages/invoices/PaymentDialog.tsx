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
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { formatCurrency } from "@/lib/utils";
import type { Invoice } from "@/lib/store";

interface PaymentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  totalCredited?: number;
  paymentType: string;
  onPaymentTypeChange: (val: string) => void;
  paymentAmount: string;
  onPaymentAmountChange: (val: string) => void;
  paymentMethod: string;
  onPaymentMethodChange: (val: string) => void;
  onConfirm: () => Promise<void>;
  isSubmitting?: boolean;
}

export function PaymentDialog({
  isOpen,
  onOpenChange,
  invoice,
  totalCredited = 0,
  paymentType,
  onPaymentTypeChange,
  paymentAmount,
  onPaymentAmountChange,
  paymentMethod,
  onPaymentMethodChange,
  onConfirm,
  isSubmitting,
}: PaymentDialogProps) {
  const totalPaid = invoice?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const remaining = Math.max(0, (invoice?.total || 0) - totalPaid - totalCredited);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border" side="right">
        <DialogHeader>
          <DialogTitle className="text-foreground">Confirmer le règlement</DialogTitle>
          <VisuallyHidden>
            <DialogDescription>
              Formulaire pour enregistrer un paiement partiel ou total pour cette facture
            </DialogDescription>
          </VisuallyHidden>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">
              Type de règlement <span className="text-destructive">*</span>
            </Label>
            <Select value={paymentType} onValueChange={onPaymentTypeChange} disabled={isSubmitting}>
              <SelectTrigger className="bg-secondary border-border text-foreground h-11">
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="full">Solde complet (100%)</SelectItem>
                <SelectItem value="acompte">Acompte / Partiel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="payment-amount"
              className="text-muted-foreground text-xs uppercase font-bold tracking-wider"
            >
              Montant du paiement (XAF) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="payment-amount"
              type="number"
              value={paymentAmount}
              onChange={(e) => onPaymentAmountChange(e.target.value)}
              className="bg-secondary border-border h-11 font-bold text-lg"
              disabled={paymentType === "full" || isSubmitting}
            />
            {invoice && (
              <div className="space-y-0.5">
                {totalCredited > 0 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider font-bold">
                    Avoir(s) déduit(s): -{formatCurrency(totalCredited)}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                  Reste net à régler: {formatCurrency(remaining)}
                </p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">
              Mode de règlement <span className="text-destructive">*</span>
            </Label>
            <Select value={paymentMethod} onValueChange={onPaymentMethodChange} disabled={isSubmitting}>
              <SelectTrigger className="bg-secondary border-border text-foreground h-11">
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="Espèces">Espèces</SelectItem>
                <SelectItem value="Airtel Money">Airtel Money</SelectItem>
                <SelectItem value="Moov Money">Moov Money</SelectItem>
                <SelectItem value="Virement Bancaire">Virement Bancaire</SelectItem>
                <SelectItem value="Chèque">Chèque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="success"
            onClick={onConfirm}
            className="w-full font-bold h-11"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enregistrement..." : "Valider l'encaissement"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
