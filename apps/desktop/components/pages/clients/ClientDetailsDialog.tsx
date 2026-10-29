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
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Mail, Phone, MapPin, Edit2 } from "lucide-react";
import { formatCurrency, getInitials, cn } from "@/lib/utils";
import type { Client, Invoice, User } from "@/lib/store";

interface ClientDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  invoices: Invoice[];
  user: User | null;
  onEdit: (client: Client) => void;
}

export function ClientDetailsDialog({
  isOpen,
  onOpenChange,
  client,
  invoices,
  user,
  onEdit,
}: ClientDetailsDialogProps) {
  if (!client) return null;

  const clientPaidTotal = invoices
    ?.filter((inv) => inv.clientId === client.id && inv.status === "PAID")
    .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0;

  const clientInvoicesCount =
    invoices?.filter((inv) => inv.clientId === client.id).length || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3.5 mb-1">
            <div className="relative w-12 h-12 flex-shrink-0">
              <Avatar className="w-12 h-12 ring-2 ring-primary/20">
                <AvatarFallback className="bg-primary text-primary-foreground font-bold text-base">
                  {getInitials(client.name)}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  "absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full ring-2 ring-card shadow-sm",
                  client.status === "inactive" ? "bg-amber-500" : "bg-emerald-500"
                )}
                title={client.status === "inactive" ? "Client inactif / suspendu" : "Client actif"}
              />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-foreground text-xl font-bold truncate">
                {client.name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge
                  variant={client.status === "inactive" ? "inactive" : "active"}
                  label={client.status === "inactive" ? "Compte Inactif" : "Compte Actif"}
                />
                {client.nif && (
                  <span className="text-[11px] font-mono text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded border border-border/50">
                    NIF: {client.nif}
                  </span>
                )}
              </div>
            </div>
          </div>
          <VisuallyHidden>
            <DialogDescription>Fiche complète et coordonnées du client</DialogDescription>
          </VisuallyHidden>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Coordonnées & Contact */}
          <div className="p-3.5 rounded-lg bg-secondary/30 border border-border/60 space-y-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Coordonnées & Contact
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-center gap-2 text-foreground">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">
                  {client.email ? (
                    <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                      {client.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground/60 italic">Pas d'adresse email</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Phone className="w-4 h-4 text-primary shrink-0" />
                <span>
                  {client.phone ? (
                    <a href={`tel:${client.phone}`} className="hover:underline">
                      {client.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground/60 italic">Non renseigné</span>
                  )}
                </span>
              </div>
              <div className="flex items-start gap-2 text-foreground sm:col-span-2">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  {client.address || (
                    <span className="text-muted-foreground/60 italic">
                      Aucune adresse géographique enregistrée
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Mentions fiscales CEMAC */}
          <div className="p-3.5 rounded-lg bg-secondary/20 border border-border/50 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Identifiants Fiscaux & Réglementaires (OHADA / Gabon)
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">NIF :</span>
                <p className="font-mono font-medium text-foreground mt-0.5">
                  {client.nif || <span className="text-muted-foreground/50 font-normal italic">—</span>}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">RCCM :</span>
                <p className="font-mono font-medium text-foreground mt-0.5">
                  {client.rccm || <span className="text-muted-foreground/50 font-normal italic">—</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Synthèse Facturation */}
          <div className="p-3.5 rounded-lg bg-secondary/30 border border-border/50 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Volume d'Affaires Encaissé
              </div>
              <div className="text-lg font-bold text-foreground mt-0.5">
                {formatCurrency(clientPaidTotal)}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{clientInvoicesCount}</span> facture(s) émise(s)
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            {(user?.role === "admin" || user?.role === "user") && (
              <Button
                variant="default"
                className="gap-1.5"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(client);
                }}
              >
                <Edit2 className="w-4 h-4" /> Modifier ce client
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
