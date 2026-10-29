"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { formatCurrency } from "@/lib/utils";
import type { DraftItem, Service } from "@/lib/store";

interface EditorItemsTableProps {
  items: DraftItem[];
  services: Service[];
  onUpdateItem: (id: string, field: keyof DraftItem, value: string | number) => void;
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  isSubmitting?: boolean;
}

export function EditorItemsTable({
  items,
  services,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
  isSubmitting,
}: EditorItemsTableProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground font-semibold text-base">
            Prestations & Produits
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddItem}
            className="text-primary hover:text-primary hover:bg-primary/10"
            disabled={isSubmitting}
          >
            <Plus className="w-4 h-4 mr-1" />
            Ajouter une ligne
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-2 md:gap-4 px-4 py-3 bg-secondary/20 rounded-t-lg text-sm font-semibold text-muted-foreground border-b border-border hidden md:grid">
            <div className="col-span-6">
              Description <span className="text-destructive">*</span>
            </div>
            <div className="col-span-2 text-right">
              Qté <span className="text-destructive">*</span>
            </div>
            <div className="col-span-2 text-right">
              Prix U. (XAF) <span className="text-destructive">*</span>
            </div>
            <div className="col-span-2 text-right pr-2">Total HT</div>
          </div>

          {items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-12 gap-2 md:gap-4 items-start p-3 rounded-xl bg-muted/30"
            >
              <div className="col-span-12 md:col-span-6">
                <Select
                  onValueChange={(val) => onUpdateItem(item.id, "description", val)}
                  value={item.description || ""}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="bg-transparent border-0 md:border md:bg-secondary focus:ring-1 text-foreground">
                    <SelectValue placeholder="Sélectionner un service..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        <div className="flex flex-col">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">
                            {s.category} • {formatCurrency(s.unitPrice)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-4 md:col-span-2">
                <Input
                  type="number"
                  min="0.01"
                  step="any"
                  value={item.quantity ?? 1}
                  onChange={(e) =>
                    onUpdateItem(item.id, "quantity", parseFloat(e.target.value) || 0)
                  }
                  className="text-right tabular-nums"
                  disabled={isSubmitting}
                />
              </div>
              <div className="col-span-4 md:col-span-2">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={item.unitPrice ?? 0}
                  onChange={(e) =>
                    onUpdateItem(item.id, "unitPrice", Math.round(parseFloat(e.target.value) || 0))
                  }
                  className="text-right tabular-nums"
                  disabled={isSubmitting}
                />
              </div>
              <div className="col-span-3 md:col-span-1 text-right pt-2 font-medium tabular-nums">
                {formatCurrency(item.total)}
              </div>
              <div className="col-span-1 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveItem(item.id)}
                  className="text-muted-foreground hover:text-destructive"
                  disabled={items.length === 1 || isSubmitting}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
