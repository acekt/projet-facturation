"use client";

import * as React from "react";
import { Send, Eye, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { formatCurrency } from "@/lib/utils";

interface FiscalSummaryCardProps {
  subtotal: number;
  discount: number;
  onDiscountChange: (discount: number) => void;
  netHT: number;
  cssAmount: number;
  taxBase: number;
  tpsAmount: number;
  tvaAmount: number;
  total: number;
  cssRate?: number;
  tpsRate?: number;
  tvaRate?: number;
  isSubmitting: boolean;
  canPreview: boolean;
  onPreview: () => void;
  onSave: () => Promise<void>;
  saveLabel: string;
  onSaveDraft?: () => Promise<void>;
  saveDraftLabel?: string;
}

export function FiscalSummaryCard({
  subtotal,
  discount,
  onDiscountChange,
  netHT,
  cssAmount,
  taxBase,
  tpsAmount,
  tvaAmount,
  total,
  cssRate = 0,
  tpsRate = 9.5,
  tvaRate = 0,
  isSubmitting,
  canPreview,
  onPreview,
  onSave,
  saveLabel,
  onSaveDraft,
  saveDraftLabel = "Enregistrer Brouillon",
}: FiscalSummaryCardProps) {
  return (
    <Card className="bg-card border-border sticky top-24">
      <CardHeader className="pb-4">
        <CardTitle className="text-foreground font-semibold text-base">
          Récapitulatif Financier
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total HT Brut</span>
            <span className="text-foreground font-medium text-right tabular-nums">
              {formatCurrency(subtotal)}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm items-center">
              <span className="text-muted-foreground">Remise Commerciale</span>
              <Input
                type="number"
                className="w-24 h-7 text-right tabular-nums text-sm"
                value={discount || 0}
                onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-border/50">
            <div className="flex justify-between text-sm font-semibold">
              <span>Net HT</span>
              <span className="text-right tabular-nums">{formatCurrency(netHT)}</span>
            </div>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">CSS ({cssRate}%)</span>
            <span className="text-foreground text-right tabular-nums">
              {formatCurrency(cssAmount)}
            </span>
          </div>

          <div className="pt-1 border-t border-dashed border-border/30">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-muted-foreground">Base TVA</span>
              <span className="text-right tabular-nums">{formatCurrency(taxBase)}</span>
            </div>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">TPS ({tpsRate}%)</span>
            <span className="text-foreground text-right tabular-nums">
              {formatCurrency(tpsAmount)}
            </span>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">TVA ({tvaRate}%)</span>
            <span className="text-foreground text-right tabular-nums">
              {formatCurrency(tvaAmount)}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="text-foreground font-bold">TOTAL TTC (XAF)</span>
            <span className="text-2xl font-bold text-primary text-right tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        <div className="pt-4 space-y-3">
          <Button
            variant="outline"
            className="w-full h-12 gap-2 bg-secondary"
            onClick={onPreview}
            disabled={isSubmitting || !canPreview}
          >
            <Eye className="w-4 h-4" />
            Aperçu
          </Button>

          {onSaveDraft && (
            <Button
              variant="outline"
              className="w-full h-12 gap-2"
              onClick={onSaveDraft}
              disabled={isSubmitting}
            >
              <Save className="w-4 h-4" />
              {saveDraftLabel}
            </Button>
          )}

          <Button
            onClick={onSave}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 transition-all"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Send className="w-4 h-4 mr-2 animate-pulse" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {isSubmitting ? "Enregistrement..." : saveLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
