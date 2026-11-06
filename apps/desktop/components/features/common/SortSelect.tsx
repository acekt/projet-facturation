"use client";

import * as React from "react";
import { ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@/lib/utils";

export type UniversalSortOption =
  | "recent"
  | "oldest"
  | "amount_desc"
  | "amount_asc"
  | "alpha_asc";

export interface SortSelectProps {
  value: string;
  onValueChange: (value: any) => void;
  type?: "currency" | "quantity" | "standard";
  className?: string;
}

export function SortSelect({
  value,
  onValueChange,
  type = "currency",
  className,
}: SortSelectProps) {
  const highLabel =
    type === "quantity"
      ? "Quantité décroissante"
      : type === "standard"
      ? "Valeur décroissante"
      : "Montant décroissant";

  const lowLabel =
    type === "quantity"
      ? "Quantité croissante"
      : type === "standard"
      ? "Valeur croissante"
      : "Montant croissant";

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          "w-full sm:w-[210px] h-10 text-xs bg-card border-border shadow-xs",
          className
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <SelectValue placeholder="Trier par..." />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-card border-border">
        <SelectItem value="recent">Plus récents d&apos;abord</SelectItem>
        <SelectItem value="oldest">Plus anciens d&apos;abord</SelectItem>
        <SelectItem value="amount_desc">{highLabel}</SelectItem>
        <SelectItem value="amount_asc">{lowLabel}</SelectItem>
        <SelectItem value="alpha_asc">Alphabétique (A-Z)</SelectItem>
      </SelectContent>
    </Select>
  );
}

