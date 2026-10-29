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

export interface ServiceFormData {
  name: string;
  description: string;
  category: string;
  unitPrice: number;
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
              placeholder="Ex: Audit de sécurité informatique"
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
