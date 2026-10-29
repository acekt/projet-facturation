"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Textarea } from "@workspace/ui/components/textarea";

interface QuoteNotesCardProps {
  notes: string;
  onChange: (notes: string) => void;
  disabled?: boolean;
}

export function QuoteNotesCard({ notes, onChange, disabled = false }: QuoteNotesCardProps) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground font-semibold text-base">Notes et Conditions</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          value={notes || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Indiquez la durée de validité du devis, les conditions de règlement ou toute mention complémentaire..."
          className="min-h-[90px] resize-y bg-secondary/30 border-border text-sm focus:ring-1"
          disabled={disabled}
        />
      </CardContent>
    </Card>
  );
}

