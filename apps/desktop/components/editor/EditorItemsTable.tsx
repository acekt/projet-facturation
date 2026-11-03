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
import { ServiceFormDialog, type ServiceFormData } from "@/components/pages/services/ServiceFormDialog";
import { createService } from "@/app/actions/service.actions";
import { toast } from "sonner";
import { useStore } from "@/lib/store";

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
  const [isServiceFormOpen, setIsServiceFormOpen] = React.useState(false);
  const [isCreatingService, setIsCreatingService] = React.useState(false);
  const [targetItemId, setTargetItemId] = React.useState<string | null>(null);
  const addService = useStore((s) => s.addService);

  const [serviceFormData, setServiceFormData] = React.useState<ServiceFormData>({
    name: "", category: "Service", unitPrice: 0, description: ""
  });

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingService(true);
    try {
      const res = await createService(serviceFormData);
      if (res.success && res.data) {
        addService(res.data as Service);
        if (targetItemId) {
          onUpdateItem(targetItemId, "description", res.data.name);
          onUpdateItem(targetItemId, "unitPrice", res.data.unitPrice);
        }
        setIsServiceFormOpen(false);
        toast.success("Service créé et ajouté avec succès");
      } else {
        toast.error(res.error || "Erreur lors de la création du service");
      }
    } catch (e) {
      toast.error("Erreur serveur lors de la création du service");
    } finally {
      setIsCreatingService(false);
    }
  };
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
              <button
                type="button"
                onClick={() => setIsServiceFormOpen(true)}
                className="text-[10px] font-bold text-primary hover:underline ml-2"
              >
                + Nouveau
              </button>
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
                <div className="flex items-center gap-1 w-full">
                  <Select
                    onValueChange={(val) => onUpdateItem(item.id as string, "description", val)}
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
                <button
                  type="button"
                  onClick={() => {
                    setTargetItemId(item.id as string);
                    setIsServiceFormOpen(true);
                  }}
                  className="md:hidden text-primary p-2 flex-shrink-0"
                  title="Nouveau Service"
                >
                  <Plus className="w-4 h-4" />
                </button>
                </div>
              </div>
              <div className="col-span-4 md:col-span-2">
                <Input
                  type="number"
                  min="0.01"
                  step="any"
                  value={item.quantity ?? 1}
                  onChange={(e) =>
                    onUpdateItem(item.id as string, "quantity", parseFloat(e.target.value) || 0)
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
                    onUpdateItem(item.id as string, "unitPrice", Math.round(parseFloat(e.target.value) || 0))
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
                  onClick={() => onRemoveItem(item.id as string)}
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
      <ServiceFormDialog
        isEdit={false}
        isOpen={isServiceFormOpen}
        onOpenChange={setIsServiceFormOpen}
        formData={serviceFormData}
        onChange={setServiceFormData}
        onSubmit={handleCreateService}
        isSubmitting={isCreatingService}
      />
    </Card>
  );
}
