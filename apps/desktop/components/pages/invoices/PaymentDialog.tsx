"use client";

import * as React from "react";
import { RefreshCw, Sparkles } from "lucide-react";
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
import { DatePicker } from "@workspace/ui/components/date-picker";
import { EditableSelect } from "@/components/features/common/EditableSelect";
import { formatCurrency } from "@/lib/utils";
import type { Invoice } from "@/lib/store";

export function generateAutoPaymentReference(dateStr?: string): string {
  const cleanDate = (dateStr || new Date().toISOString().slice(0, 10))
    .slice(0, 10)
    .replace(/-/g, "");
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `REG-${cleanDate}-${rand}`;
}

export const DEFAULT_PAYMENT_METHODS = [
  "Espèces",
  "Airtel Money",
  "Moov Money",
  "Virement Bancaire",
  "Chèque",
  "Carte Bancaire",
] as const;

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
  paymentDate: string;
  onPaymentDateChange: (val: string) => void;
  paymentReference: string;
  onPaymentReferenceChange: (val: string) => void;
  onConfirm: () => Promise<void>;
  isSubmitting?: boolean;
}

const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={`w-full bg-secondary overflow-hidden rounded-full ${className}`}>
    <div className="h-full bg-primary transition-all" style={{ width: `${value}%` }} />
  </div>
);

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
  paymentDate,
  onPaymentDateChange,
  paymentReference,
  onPaymentReferenceChange,
  onConfirm,
  isSubmitting,
}: PaymentDialogProps) {
  const totalPaid = invoice?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const progress = invoice?.total
    ? Math.min(100, Math.round(((totalPaid + totalCredited) / invoice.total) * 100))
    : 0;
  const remaining = Math.max(0, (invoice?.total || 0) - totalPaid - totalCredited);
  const submitLockRef = React.useRef(false);

  const handleConfirm = async () => {
    if (submitLockRef.current || isSubmitting) return;
    submitLockRef.current = true;
    try {
      await onConfirm();
    } finally {
      submitLockRef.current = false;
    }
  };

  React.useEffect(() => {
    if (isOpen && (!paymentReference || !paymentReference.trim())) {
      onPaymentReferenceChange(generateAutoPaymentReference(paymentDate));
    }
  }, [isOpen, paymentDate, paymentReference, onPaymentReferenceChange]);

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
          {invoice && (
            <div className="p-3 bg-secondary/30 rounded-lg border border-border/50 space-y-2 mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground font-medium">Progression du règlement</span>
                <span className="font-bold text-primary">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              {invoice.payments && invoice.payments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Historique des acomptes
                  </span>
                  {invoice.payments.map((p, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span>
                        {p.date} ({p.paymentMethod})
                      </span>
                      <span className="font-semibold">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
              htmlFor="payment-date"
              className="text-muted-foreground text-xs uppercase font-bold tracking-wider"
            >
              Date du paiement <span className="text-destructive">*</span>
            </Label>
            <DatePicker
              value={paymentDate}
              onChange={(iso) => onPaymentDateChange(iso)}
              placeholder="JJ/MM/AAAA"
              disabled={isSubmitting}
              className="bg-secondary border-border h-11"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="payment-reference"
                className="text-muted-foreground text-xs uppercase font-bold tracking-wider"
              >
                Référence du paiement
              </Label>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                <Sparkles className="w-2.5 h-2.5" />
                Générée automatiquement
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="payment-reference"
                type="text"
                placeholder="Ex: REG-20261105-4821 ou N° Chèque..."
                value={paymentReference}
                onChange={(e) => onPaymentReferenceChange(e.target.value)}
                className="bg-secondary border-border h-11 font-mono text-sm"
                disabled={isSubmitting}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Générer une nouvelle référence automatique"
                disabled={isSubmitting}
                onClick={() =>
                  onPaymentReferenceChange(generateAutoPaymentReference(paymentDate))
                }
                className="h-11 w-11 shrink-0 border-border"
              >
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
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
            <EditableSelect
              groupKey="payment_method"
              value={paymentMethod || "Espèces"}
              onChange={onPaymentMethodChange}
              defaultOptions={[...DEFAULT_PAYMENT_METHODS]}
              placeholder="Sélectionner un mode de règlement"
              addPlaceholder="Nouveau mode de règlement..."
              disabled={isSubmitting}
            />
          </div>
          <Button
            onClick={handleConfirm}
            className="w-full font-bold h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enregistrement..." : "Valider l'encaissement"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
