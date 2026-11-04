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

import { Switch } from "@workspace/ui/components/switch";

export interface ServiceFormData {
  name: string;
  description: string;
  category: string;
  unitPrice: number;
  trackStock?: number;
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
      <DialogContent className="bg-card border-border" side="right">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? "Modifier le service" : "Nouveau Service"}
          </DialogTitle>
          <VisuallyHidden>
            <DialogDescription>
              {isEdit ? "Formulaire de modification du service" : "Formulaire pour ajouter une prestation au catalogue"}
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
              placeholder="Entrez l'objet du document"
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
              <Select
                value={formData.category || "Prestation de services"}
                onValueChange={(val) => onChange({ ...formData, category: val })}
                disabled={isSubmitting}
              >
                <SelectTrigger id="service-category" className="w-full bg-secondary border-border text-foreground">
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {PREDEFINED_SERVICE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                  {formData.category &&
                    !PREDEFINED_SERVICE_CATEGORIES.includes(formData.category as (typeof PREDEFINED_SERVICE_CATEGORIES)[number]) && (
                      <SelectItem value={formData.category}>{formData.category}</SelectItem>
                    )}
                </SelectContent>
              </Select>
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
                value={formData.unitPrice}
                onChange={(e) => onChange({ ...formData, unitPrice: parseInt(e.target.value, 10) || 0 })}
                className="bg-secondary border-border text-right"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-description" className="text-muted-foreground">
              Description <span className="text-xs text-muted-foreground/60">(optionnel)</span>
            </Label>
            <Input
              id="service-description"
              value={formData.description}
              onChange={(e) => onChange({ ...formData, description: e.target.value })}
              placeholder="Détails du service..."
              className="bg-secondary border-border"
              disabled={isSubmitting}
            />
          </div>

          <div className="pt-4 border-t border-border mt-4">
             <div className="flex items-center justify-between mb-4">
               <div>
                  <Label htmlFor="track-stock" className="text-foreground font-medium">Activer le suivi de stock</Label>
                  <p className="text-xs text-muted-foreground">Suivre les entrées et sorties pour cet article</p>
               </div>
               <Switch
                  id="track-stock"
                  checked={formData.trackStock === 1}
                  onCheckedChange={(checked) => onChange({ ...formData, trackStock: checked ? 1 : 0 })}
                  disabled={isSubmitting || (isEdit && formData.trackStock === 1)}
               />
             </div>

             {formData.trackStock === 1 && (
                <div className="grid grid-cols-3 gap-4 bg-muted/50 p-4 rounded-lg">
                   <div className="space-y-2">
                      <Label htmlFor="stock-initial" className="text-muted-foreground">Stock initial</Label>
                      <Input
                        id="stock-initial"
                        type="number"
                        min="0"
                        value={formData.stockQuantity || 0}
                        onChange={(e) => onChange({ ...formData, stockQuantity: parseInt(e.target.value, 10) || 0 })}
                        disabled={isSubmitting || isEdit}
                        className="bg-secondary"
                      />
                   </div>
                   <div className="space-y-2">
                      <Label htmlFor="stock-alert" className="text-muted-foreground">Seuil d'alerte</Label>
                      <Input
                        id="stock-alert"
                        type="number"
                        min="0"
                        value={formData.minStockAlert || 5}
                        onChange={(e) => onChange({ ...formData, minStockAlert: parseInt(e.target.value, 10) || 0 })}
                        disabled={isSubmitting}
                        className="bg-secondary"
                      />
                   </div>
                   <div className="space-y-2">
                      <Label htmlFor="stock-unit" className="text-muted-foreground">Unité</Label>
                      <Input
                        id="stock-unit"
                        value={formData.unit || "Unité"}
                        onChange={(e) => onChange({ ...formData, unit: e.target.value })}
                        disabled={isSubmitting}
                        className="bg-secondary"
                        placeholder="ex: kg, L, Unité"
                      />
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
