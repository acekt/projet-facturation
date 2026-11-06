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
import { Switch } from "@workspace/ui/components/switch";
import { EditableSelect } from "@/components/features/common/EditableSelect";

export const PREDEFINED_SERVICE_CATEGORIES = [
  "Prestation de services",
  "Conseil & Expertise",
  "Développement & IT",
  "Maintenance & Support",
  "Formation & Coaching",
  "Design & Communication",
  "Logistique & Transport",
  "BTP & Travaux",
  "Fournitures & Équipements",
  "Autre prestation",
] as const;

export const PREDEFINED_STOCK_UNITS = [
  "Unité",
  "Pièce",
  "Kg",
  "Litre",
  "Mètre",
  "Carton",
  "Boîte",
  "Lot",
  "Forfait",
] as const;

export interface ServiceFormData {
  name: string;
  description: string;
  category: string;
  unitPrice: number;
  trackStock?: number;
  stockItemName?: string | null;
  stockQuantity?: number;
  minStockAlert?: number;
  unit?: string | null;
}

interface ServiceFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isEdit: boolean;
  formData: ServiceFormData;
  onChange: (data: ServiceFormData) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  isSubmitting: boolean;
}

export function ServiceFormDialog({
  isOpen,
  onOpenChange,
  isEdit,
  formData,
  onChange,
  onSubmit,
  isSubmitting,
}: ServiceFormDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[540px]" side="right">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? "Modifier le service" : "Nouveau Service"}
          </DialogTitle>
          <VisuallyHidden>
            <DialogDescription>
              {isEdit
                ? "Formulaire de modification du service"
                : "Formulaire pour ajouter une prestation au catalogue"}
            </DialogDescription>
          </VisuallyHidden>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="service-name" className="text-muted-foreground">
              Désignation du service <span className="text-destructive">*</span>
            </Label>
            <Input
              id="service-name"
              value={formData.name}
              onChange={(e) => onChange({ ...formData, name: e.target.value })}
              placeholder="Ex: Maintenance préventive, Installation réseau, Ramette A4..."
              className="bg-secondary border-border"
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service-category" className="text-muted-foreground">
                Catégorie <span className="text-destructive">*</span>
              </Label>
              <EditableSelect
                id="service-category"
                groupKey="service_category"
                value={formData.category || "Prestation de services"}
                onChange={(val) => onChange({ ...formData, category: val })}
                defaultOptions={[...PREDEFINED_SERVICE_CATEGORIES]}
                placeholder="Choisir une catégorie"
                addPlaceholder="Nouvelle catégorie..."
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-price" className="text-muted-foreground">
                Prix Unitaire (XAF) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="service-price"
                type="number"
                step="1"
                min="0"
                placeholder="Ex: 75000"
                value={formData.unitPrice}
                onChange={(e) =>
                  onChange({
                    ...formData,
                    unitPrice: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="bg-secondary border-border text-right"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-description" className="text-muted-foreground">
              Description{" "}
              <span className="text-xs text-muted-foreground/60">(optionnel)</span>
            </Label>
            <Input
              id="service-description"
              value={formData.description}
              onChange={(e) =>
                onChange({ ...formData, description: e.target.value })
              }
              placeholder="Ex: Diagnostic complet sur site, pièces détachées et main d'œuvre..."
              className="bg-secondary border-border"
              disabled={isSubmitting}
            />
          </div>

          <div className="pt-4 border-t border-border mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Label htmlFor="track-stock" className="text-foreground font-medium">
                  Activer le suivi de stock
                </Label>
                <p className="text-xs text-muted-foreground">
                  Suivre les entrées et sorties physiques pour cet article
                </p>
              </div>
              <Switch
                id="track-stock"
                checked={Boolean(formData.trackStock)}
                onCheckedChange={(checked) =>
                  onChange({ ...formData, trackStock: checked ? 1 : 0 })
                }
                disabled={isSubmitting || (isEdit && Boolean(formData.trackStock))}
              />
            </div>

            {Boolean(formData.trackStock) && (
              <div className="space-y-4 bg-muted/50 p-4 rounded-lg border border-border/60">
                <div className="space-y-1.5">
                  <Label htmlFor="stock-item-name" className="text-muted-foreground">
                    Désignation de l&apos;article en stock (Nom physique)
                  </Label>
                  <Input
                    id="stock-item-name"
                    value={formData.stockItemName ?? ""}
                    onChange={(e) =>
                      onChange({ ...formData, stockItemName: e.target.value })
                    }
                    disabled={isSubmitting}
                    className="bg-secondary border-border"
                    placeholder="Entrez le nom de l'article en stock (ex: Extincteur ABC 1 KG)"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Permet d&apos;afficher le nom de l&apos;équipement physique dans la Gestion des Stocks (indépendamment de l&apos;intitulé commercial facturé).
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stock-initial" className="text-muted-foreground">
                      Stock initial
                    </Label>
                    <Input
                      id="stock-initial"
                      type="number"
                      min="0"
                      placeholder="Ex: 50"
                      value={formData.stockQuantity ?? 0}
                      onChange={(e) =>
                        onChange({
                          ...formData,
                          stockQuantity: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      disabled={isSubmitting || isEdit}
                      className="bg-secondary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock-alert" className="text-muted-foreground">
                      Seuil d&apos;alerte
                    </Label>
                    <Input
                      id="stock-alert"
                      type="number"
                      min="0"
                      placeholder="Ex: 5"
                      value={formData.minStockAlert ?? 5}
                      onChange={(e) =>
                        onChange({
                          ...formData,
                          minStockAlert: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      disabled={isSubmitting}
                      className="bg-secondary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock-unit" className="text-muted-foreground">
                      Unité
                    </Label>
                    <EditableSelect
                      id="stock-unit"
                      groupKey="stock_unit"
                      value={formData.unit || "Unité"}
                      onChange={(val) => onChange({ ...formData, unit: val })}
                      defaultOptions={[...PREDEFINED_STOCK_UNITS]}
                      placeholder="Unité"
                      addPlaceholder="Nouvelle unité..."
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-4 h-11"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Enregistrement..."
              : isEdit
              ? "Enregistrer les modifications"
              : "Enregistrer dans le catalogue"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
