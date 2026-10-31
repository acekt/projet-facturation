"use client";

import * as React from "react";
import { User, Search, Calendar, FileText } from "lucide-react";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { DatePicker } from "@workspace/ui/components/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@workspace/ui/components/dialog";
import { VisuallyHidden } from "@workspace/ui/components/visually-hidden";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { getInitials } from "@/lib/utils";
import type { Client } from "@/lib/store";

interface DocumentCommercialHeaderProps {
  type: "devis" | "facture";
  client: Client | null;
  onSelectClient: (c: Client | null) => void;
  clients: Client[];
  docDate: string;
  onDocDateChange: (d: string) => void;
  secondaryDate: string;
  onSecondaryDateChange: (d: string) => void;
  secondaryDateLabel: string;
  subject: string;
  onSubjectChange: (s: string) => void;
  disabled?: boolean;
}

export function DocumentCommercialHeader({
  type,
  client,
  onSelectClient,
  clients,
  docDate,
  onDocDateChange,
  secondaryDate,
  onSecondaryDateChange,
  secondaryDateLabel,
  subject,
  onSubjectChange,
  disabled = false,
}: DocumentCommercialHeaderProps) {
  const [clientSearchOpen, setClientSearchOpen] = React.useState(false);
  const [clientSearch, setClientSearch] = React.useState("");

  const filteredClients = React.useMemo(() => {
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        (c.email || "").toLowerCase().includes(clientSearch.toLowerCase()) ||
        (c.phone || "").toLowerCase().includes(clientSearch.toLowerCase())
    );
  }, [clients, clientSearch]);

  return (
    <Card className="bg-card border-border shadow-sm overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* COLONNE GAUCHE (5 cols) : SÉLECTION CLIENT */}
          <div className="lg:col-span-5 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-border pb-4 lg:pb-0 lg:pr-5">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-foreground font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                Client destinataire <span className="text-destructive">*</span>
              </Label>
              {client && !disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectClient(null)}
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Changer
                </Button>
              )}
            </div>

            {client ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border/70 flex-1">
                <Avatar className="w-10 h-10 ring-2 ring-primary/20">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {getInitials(client.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground font-semibold text-sm truncate">{client.name}</p>
                  <p className="text-muted-foreground text-xs truncate">
                    {client.email || client.phone || "Aucun contact renseigné"}
                  </p>
                </div>
              </div>
            ) : (
              <Dialog open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                <DialogTrigger asChild>
                  <button
                    disabled={disabled}
                    className="flex-1 w-full min-h-[68px] p-3 rounded-xl border border-dashed border-border hover:border-primary/60 hover:bg-muted/30 transition-all text-left group flex items-center gap-3 cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <User className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div>
                      <p className="text-foreground font-medium text-xs group-hover:text-primary transition-colors">
                        Sélectionner un client <span className="text-destructive">*</span>
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        Cliquez pour rechercher dans votre base
                      </p>
                    </div>
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle className="text-foreground text-base">Sélectionner un client</DialogTitle>
                    <VisuallyHidden>
                      <DialogDescription>Rechercher un client dans votre portefeuille</DialogDescription>
                    </VisuallyHidden>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher par nom, email, téléphone..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="pl-9 bg-secondary border-border"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-[260px] overflow-y-auto space-y-1 pr-1">
                      {filteredClients.length > 0 ? (
                        filteredClients.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              onSelectClient(c);
                              setClientSearchOpen(false);
                            }}
                            className="w-full p-2.5 rounded-lg hover:bg-secondary/80 flex items-center gap-3 text-left transition-colors cursor-pointer"
                          >
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                {getInitials(c.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-foreground font-medium text-xs truncate">{c.name}</p>
                              <p className="text-muted-foreground text-[11px] truncate">
                                {c.email || c.phone || "—"}
                              </p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="py-6 text-center text-xs text-muted-foreground">
                          Aucun client trouvé pour « {clientSearch} »
                        </div>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* COLONNE DROITE (7 cols) : DATES & OBJET */}
          <div className="lg:col-span-7 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs flex items-center gap-1 font-medium">
                  <Calendar className="w-3 h-3" />
                  Date d&apos;émission <span className="text-destructive">*</span>
                </Label>
                <DatePicker value={docDate || ""} onChange={onDocDateChange} disabled={disabled} />
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs flex items-center gap-1 font-medium">
                  <Calendar className="w-3 h-3" />
                  {secondaryDateLabel}
                </Label>
                <DatePicker value={secondaryDate || ""} onChange={onSecondaryDateChange} disabled={disabled} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs flex items-center gap-1 font-medium">
                <FileText className="w-3 h-3" />
                Objet {type === "devis" ? "du devis" : "de la facture"}
              </Label>
              <Input
                value={subject || ""}
                onChange={(e) => onSubjectChange(e.target.value)}
                placeholder={
                  type === "devis"
                    ? "Ex: Prestation de conseil ou maintenance réseau..."
                    : "Ex: Facturation mensuelle de prestations ou livraison matériel..."
                }
                className="bg-secondary/60 border-border text-foreground text-xs h-9"
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
