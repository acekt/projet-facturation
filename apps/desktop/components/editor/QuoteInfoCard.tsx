"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

interface QuoteInfoCardProps {
  quoteDate: string;
  validUntil: string;
  subject: string;
  disabled?: boolean;
  onQuoteDateChange: (date: string) => void;
  onValidUntilChange: (date: string) => void;
  onSubjectChange: (subject: string) => void;
}

export function QuoteInfoCard({
  quoteDate,
  validUntil,
  subject,
  disabled = false,
  onQuoteDateChange,
  onValidUntilChange,
  onSubjectChange,
}: QuoteInfoCardProps) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-foreground font-semibold text-base">Informations du Devis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm">
              Date d'émission <span className="text-destructive">*</span>
            </Label>
            <DatePicker value={quoteDate || ""} onChange={onQuoteDateChange} disabled={disabled} />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm">Date de validité</Label>
            <DatePicker value={validUntil || ""} onChange={onValidUntilChange} disabled={disabled} />
          </div>
        </div>
        <div className="space-y-2 pt-2">
          <Label className="text-muted-foreground text-sm">Objet du devis</Label>
          <Input
            value={subject || ""}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Ex: Prestation de conseil ou maintenance réseau..."
            className="bg-secondary border-border text-foreground"
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}

