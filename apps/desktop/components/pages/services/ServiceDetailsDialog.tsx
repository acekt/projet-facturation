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
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Briefcase, Tag, Info, Edit2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Service, User } from "@/lib/store";

interface ServiceDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service | null;
  user: User | null;
  onEdit: (service: Service) => void;
}

export function ServiceDetailsDialog({
  isOpen,
  onOpenChange,
  service,
  user,
  onEdit,
}: ServiceDetailsDialogProps) {
  if (!service) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-foreground text-base font-bold truncate">
                {service.name}
              </DialogTitle>
              <div className="mt-1">
                <StatusBadge variant="neutral" label={service.category || "Non classé"} />
              </div>
            </div>
          </div>
          <VisuallyHidden>
            <DialogDescription>Détails complets de la prestation du catalogue</DialogDescription>
          </VisuallyHidden>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tarif standard appliqué
              </div>
              <div className="text-2xl font-extrabold text-foreground mt-0.5">
                {formatCurrency(service.unitPrice)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Tag className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-primary" /> Description de la prestation
            </div>
            {service.description?.trim() ? (
              <div className="p-3.5 rounded-lg bg-secondary/20 border border-border/50 text-foreground text-xs leading-relaxed whitespace-pre-wrap">
                {service.description.trim()}
              </div>
            ) : (
              <div className="py-4 px-3 rounded-lg bg-secondary/10 border border-dashed border-border/60 text-xs text-muted-foreground/70 italic text-center">
                Aucune description complémentaire enregistrée pour ce service.
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            {user?.role === "admin" && (
              <Button
                variant="default"
                className="gap-1.5"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(service);
                }}
              >
                <Edit2 className="w-4 h-4" /> Modifier
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
