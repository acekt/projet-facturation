"use client";

import * as React from "react";
import { Plus, Trash2, Search, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { formatCurrency } from "@/lib/utils";
import type { DraftItem, Service } from "@/lib/store";
import { ServiceFormDialog, type ServiceFormData } from "@/components/pages/services/ServiceFormDialog";
import { createService } from "@/app/actions/service.actions";
import { toast } from "sonner";
import { useStore } from "@/lib/store";

interface ServicePickerProps {
  item: DraftItem;
  services: Service[];
  onSelect: (service: Service) => void;
  onOpenCreate: () => void;
  onDescriptionChange: (text: string) => void;
  disabled?: boolean;
}

function ServicePicker({
  item,
  services,
  onSelect,
  onOpenCreate,
  onDescriptionChange,
  disabled,
}: ServicePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filteredServices = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q))
    );
  }, [services, search]);

  return (
    <div className="relative flex items-center w-full">
      <Input
        value={item.description || ""}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Sélectionner ou saisir une prestation..."
        className="pr-9 text-sm bg-card border-input"
        disabled={disabled}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="absolute right-2 p-1 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            title="Catalogue de prestations et produits"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[380px] p-0 bg-card border-border shadow-xl z-50" align="start">
          <div className="p-2 border-b border-border flex items-center gap-2 bg-muted/20">
            <Search className="w-4 h-4 text-muted-foreground shrink-0 ml-1" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une prestation ou un produit..."
              className="w-full text-xs bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground py-1"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-border/40 p-1">
            {filteredServices.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                Aucun service trouvé pour &quot;{search}&quot;.
              </div>
            ) : (
              filteredServices.map((s) => {
                const isTracked = Boolean(s.trackStock);
                const qty = Number(s.stockQuantity ?? 0);
                const minAlert = Number(s.minStockAlert ?? 5);

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onSelect(s);
                      setOpen(false);
                      setSearch("");
                    }}
                    className="w-full text-left p-2.5 hover:bg-muted/50 rounded-md transition-colors space-y-1.5 cursor-pointer block"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {s.name}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0 font-medium">
                        {s.category || "Prestation"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div>
                        {isTracked ? (
                          qty <= 0 ? (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1.5 font-medium">
                              Rupture de stock
                            </Badge>
                          ) : qty <= minAlert ? (
                            <Badge className="bg-amber-600 hover:bg-amber-600 text-white text-[10px] py-0 px-1.5 font-medium">
                              Stock faible : {qty}
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] py-0 px-1.5 font-medium">
                              Stock dispo : {qty}
                            </Badge>
                          )
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            Prestation sans stock
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-foreground tabular-nums">
                        {formatCurrency(s.unitPrice)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="p-2 border-t border-border bg-muted/20">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                onOpenCreate();
              }}
              className="w-full justify-start text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau service</span>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

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
    name: "",
    category: "Prestation de services",
    unitPrice: 0,
    description: "",
  });

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingService(true);
    try {
      const res = await createService(serviceFormData);
      if (res.success && res.data) {
        addService(res.data as Service);
        if (targetItemId) {
          onUpdateItem(targetItemId, "serviceId", res.data.id);
          onUpdateItem(targetItemId, "description", res.data.name);
          onUpdateItem(targetItemId, "unitPrice", res.data.unitPrice);
        }
        setIsServiceFormOpen(false);
        toast.success("Service créé et ajouté avec succès");
      } else {
        toast.error(res.error || "Erreur lors de la création du service");
      }
    } catch {
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
            className="text-primary hover:text-primary hover:bg-primary/10 cursor-pointer"
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
            <div className="col-span-5">
              Description <span className="text-destructive">*</span>
              <button
                type="button"
                onClick={() => {
                  setTargetItemId(items[0]?.id as string || null);
                  setIsServiceFormOpen(true);
                }}
                className="text-[10px] font-bold text-primary hover:underline ml-2 cursor-pointer"
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
            <div className="col-span-1" />
          </div>

          {items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-12 gap-2 md:gap-4 items-start p-3 rounded-xl bg-muted/30"
            >
              <div className="col-span-12 md:col-span-5">
                <ServicePicker
                  item={item}
                  services={services}
                  onSelect={(s) => {
                    onUpdateItem(item.id as string, "serviceId", s.id);
                    onUpdateItem(item.id as string, "description", s.name);
                    onUpdateItem(item.id as string, "unitPrice", s.unitPrice);
                  }}
                  onOpenCreate={() => {
                    setTargetItemId(item.id as string);
                    setIsServiceFormOpen(true);
                  }}
                  onDescriptionChange={(text) =>
                    onUpdateItem(item.id as string, "description", text)
                  }
                  disabled={isSubmitting}
                />
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
                  className="text-right tabular-nums bg-card"
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
                  className="text-right tabular-nums bg-card"
                  disabled={isSubmitting}
                />
              </div>
              <div className="col-span-3 md:col-span-2 text-right pt-2 font-semibold tabular-nums whitespace-nowrap">
                {formatCurrency(item.total)}
              </div>
              <div className="col-span-1 md:col-span-1 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveItem(item.id as string)}
                  className="text-muted-foreground hover:text-destructive cursor-pointer"
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
