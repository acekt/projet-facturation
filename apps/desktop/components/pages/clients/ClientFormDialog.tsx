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
import type { Client } from "@/lib/store";

export interface ClientFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  nif: string;
  rccm: string;
  status: "active" | "inactive";
}

interface ClientFormDialogProps {
  mode: "add" | "edit";
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data: ClientFormData;
  onChange: (data: ClientFormData) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  isSubmitting: boolean;
}

export function ClientFormDialog({
  mode,
  isOpen,
  onOpenChange,
  data,
  onChange,
  onSubmit,
  isSubmitting,
}: ClientFormDialogProps) {
  const isEdit = mode === "edit";
  const title = isEdit ? "Modifier le client" : "Nouveau Client";
  const desc = isEdit ? "Formulaire de modification du client" : "Renseignez les coordonnées complètes du client";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border" side="right">
        <DialogHeader>
          <DialogTitle className="text-foreground">{title}</DialogTitle>
          <VisuallyHidden>
            <DialogDescription>{desc}</DialogDescription>
          </VisuallyHidden>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor={`${mode}-name`} className="text-muted-foreground">
              Nom complet / Raison sociale <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`${mode}-name`}
              value={data.name}
              onChange={(e) => onChange({ ...data, name: e.target.value })}
              placeholder="Ex: Societe Gabon Mining"
              className="bg-secondary border-border text-foreground"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${mode}-email`} className="text-muted-foreground">
              Email <span className="text-xs text-muted-foreground/60">(optionnel)</span>
            </Label>
            <Input
              id={`${mode}-email`}
              type="email"
              value={data.email}
              onChange={(e) => onChange({ ...data, email: e.target.value })}
              placeholder="contact@entreprise.ga"
              className="bg-secondary border-border text-foreground"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`${mode}-phone`} className="text-muted-foreground">
                Téléphone <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`${mode}-phone`}
                required
                value={data.phone}
                onChange={(e) => onChange({ ...data, phone: e.target.value })}
                placeholder="+241 01 02 03 04"
                className="bg-secondary border-border text-foreground"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${mode}-status`} className="text-muted-foreground">
                Statut <span className="text-destructive">*</span>
              </Label>
              <Select
                value={data.status}
                onValueChange={(val) => onChange({ ...data, status: val as "active" | "inactive" })}
                disabled={isSubmitting}
              >
                <SelectTrigger id={`${mode}-status`} className="w-full bg-secondary border-border text-foreground">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="inactive">Inactif / Suspendu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${mode}-address`} className="text-muted-foreground">Adresse</Label>
            <Input
              id={`${mode}-address`}
              value={data.address}
              onChange={(e) => onChange({ ...data, address: e.target.value })}
              placeholder="Libreville, Gabon"
              className="bg-secondary border-border text-foreground"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`${mode}-nif`} className="text-muted-foreground">NIF</Label>
              <Input
                id={`${mode}-nif`}
                value={data.nif}
                onChange={(e) => onChange({ ...data, nif: e.target.value })}
                placeholder="Ex: 0123456A"
                className="bg-secondary border-border text-foreground font-mono text-sm"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${mode}-rccm`} className="text-muted-foreground">RCCM</Label>
              <Input
                id={`${mode}-rccm`}
                value={data.rccm}
                onChange={(e) => onChange({ ...data, rccm: e.target.value })}
                placeholder="Ex: RG/LBV/2026/B/1234"
                className="bg-secondary border-border text-foreground font-mono text-sm"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-4"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Enregistrement..."
              : isEdit
              ? "Enregistrer les modifications"
              : "Enregistrer le client"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
