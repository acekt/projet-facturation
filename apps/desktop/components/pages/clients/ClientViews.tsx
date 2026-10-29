"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { MoreVertical, Edit2, Trash2, Users, Mail, Phone, MapPin, Eye } from "lucide-react";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { EmptyState } from "@workspace/ui/components/empty-state";
import {
  DataTable,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableHeaderCell,
  DataTableCell,
  ActionsCell,
} from "@workspace/ui/components/data-table";
import { formatCurrency, getInitials, cn } from "@/lib/utils";
import type { Client, Invoice, User } from "@/lib/store";

interface ClientViewsProps {
  clients: Client[];
  viewFormat: "table" | "horizontal" | "block";
  invoices: Invoice[];
  user: User | null;
  searchQuery: string;
  onViewDetails: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => void;
  onOpenAdd: () => void;
}

export function ClientViews({
  clients,
  viewFormat,
  invoices,
  user,
  searchQuery,
  onViewDetails,
  onEdit,
  onDelete,
  onOpenAdd,
}: ClientViewsProps) {
  const canEdit = user?.role === "admin" || user?.role === "user";
  const canDelete = user?.role === "admin";

  const getClientPaidTotal = (clientId: string) => {
    return invoices
      ?.filter((inv) => inv.clientId === clientId && inv.status === "PAID")
      .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0;
  };

  // ── 1. VUE TABLEAU ──────────────────────────────────────────────────────────
  if (!viewFormat || viewFormat === "table") {
    return (
      <DataTable>
        <DataTableHead>
          <DataTableRow>
            <DataTableHeaderCell>Client</DataTableHeaderCell>
            <DataTableHeaderCell>Email</DataTableHeaderCell>
            <DataTableHeaderCell>Téléphone</DataTableHeaderCell>
            <DataTableHeaderCell>Statut</DataTableHeaderCell>
            <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {clients.map((client) => (
            <DataTableRow key={client.id}>
              <DataTableCell>
                <div className="flex items-center gap-3">
                  <div className="relative w-8 h-8 flex-shrink-0">
                    <Avatar className="w-8 h-8 ring-1 ring-border">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                        {getInitials(client.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-card shadow-sm transition-colors",
                        client.status === "inactive" ? "bg-amber-500" : "bg-emerald-500"
                      )}
                      title={client.status === "inactive" ? "Client inactif / suspendu" : "Client actif"}
                    />
                  </div>
                  <span className="font-medium text-sm text-foreground">{client.name}</span>
                </div>
              </DataTableCell>
              <DataTableCell>{client.email || <span className="text-muted-foreground/30">—</span>}</DataTableCell>
              <DataTableCell>{client.phone || <span className="text-muted-foreground/30">—</span>}</DataTableCell>
              <DataTableCell>
                <StatusBadge
                  variant={client.status === "inactive" ? "inactive" : "active"}
                  label={client.status === "inactive" ? "Inactif" : "Actif"}
                />
              </DataTableCell>
              <ActionsCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-lg">
                    <DropdownMenuItem
                      className="gap-2 cursor-pointer font-medium"
                      onClick={() => onViewDetails(client)}
                    >
                      <Eye className="w-4 h-4 text-primary" /> Voir les détails
                    </DropdownMenuItem>
                    {canEdit && (
                      <>
                        <DropdownMenuSeparator className="bg-border/60" />
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onEdit(client)}>
                          <Edit2 className="w-4 h-4" /> Modifier
                        </DropdownMenuItem>
                      </>
                    )}
                    {canDelete && (
                      <DropdownMenuItem
                        className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                        onClick={() => onDelete(client.id)}
                      >
                        <Trash2 className="w-4 h-4" /> Supprimer
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </ActionsCell>
            </DataTableRow>
          ))}
          {clients.length === 0 && (
            <DataTableRow>
              <DataTableCell colSpan={5} className="py-8 text-center">
                <EmptyState
                  icon={Users}
                  title={searchQuery ? "Aucun client trouvé" : "Base clients vide"}
                  description={
                    searchQuery
                      ? "Aucun client ne correspond à votre recherche."
                      : "Ajoutez votre premier client pour commencer à générer des devis."
                  }
                  actionLabel={!searchQuery ? "Nouveau client" : undefined}
                  onAction={!searchQuery ? onOpenAdd : undefined}
                />
              </DataTableCell>
            </DataTableRow>
          )}
        </DataTableBody>
      </DataTable>
    );
  }

  // ── 2. VUE HORIZONTALE ──────────────────────────────────────────────────────
  if (viewFormat === "horizontal") {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        <div className="space-y-3">
          {clients.map((client) => (
            <Card key={client.id} className="bg-card border-border hover:border-primary/30 transition-all group shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative w-10 h-10 flex-shrink-0">
                      <Avatar className="w-10 h-10 ring-1 ring-border">
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                          {getInitials(client.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-card shadow-sm transition-colors",
                          client.status === "inactive" ? "bg-amber-500" : "bg-emerald-500"
                        )}
                        title={client.status === "inactive" ? "Client inactif / suspendu" : "Client actif"}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{client.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {client.email || <span className="text-muted-foreground/50">Pas d'email</span>}
                        {client.phone && <span className="text-muted-foreground/50"> • {client.phone}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      variant={client.status === "inactive" ? "inactive" : "active"}
                      label={client.status === "inactive" ? "Inactif" : "Actif"}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-lg">
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer font-medium"
                          onClick={() => onViewDetails(client)}
                        >
                          <Eye className="w-4 h-4 text-primary" /> Voir les détails
                        </DropdownMenuItem>
                        {canEdit && (
                          <>
                            <DropdownMenuSeparator className="bg-border/60" />
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onEdit(client)}>
                              <Edit2 className="w-4 h-4" /> Modifier
                            </DropdownMenuItem>
                          </>
                        )}
                        {canDelete && (
                          <DropdownMenuItem
                            className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                            onClick={() => onDelete(client.id)}
                          >
                            <Trash2 className="w-4 h-4" /> Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {clients.length === 0 && (
            <EmptyState
              icon={Users}
              title={searchQuery ? "Aucun client trouvé" : "Base clients vide"}
              description={
                searchQuery
                  ? "Aucun client ne correspond à votre recherche."
                  : "Ajoutez votre premier client pour commencer à générer des devis."
              }
              actionLabel={!searchQuery ? "Nouveau client" : undefined}
              onAction={!searchQuery ? onOpenAdd : undefined}
            />
          )}
        </div>
      </div>
    );
  }

  // ── 3. VUE BLOC / CARTES ───────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto min-h-0 pr-1">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client, index) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="bg-card border-border hover:border-primary/30 transition-all group overflow-hidden shadow-sm">
              <CardContent className="p-0">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 flex-shrink-0">
                        <Avatar className="w-10 h-10 ring-1 ring-border">
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                            {getInitials(client.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            "absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-card shadow-sm transition-colors",
                            client.status === "inactive" ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          title={client.status === "inactive" ? "Client inactif / suspendu" : "Client actif"}
                        />
                      </div>
                      <StatusBadge
                        variant={client.status === "inactive" ? "inactive" : "active"}
                        label={client.status === "inactive" ? "Inactif" : "Actif"}
                      />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-lg">
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer font-medium"
                          onClick={() => onViewDetails(client)}
                        >
                          <Eye className="w-4 h-4 text-primary" /> Voir les détails
                        </DropdownMenuItem>
                        {canEdit && (
                          <>
                            <DropdownMenuSeparator className="bg-border/60" />
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onEdit(client)}>
                              <Edit2 className="w-4 h-4" /> Modifier
                            </DropdownMenuItem>
                          </>
                        )}
                        {canDelete && (
                          <DropdownMenuItem
                            className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                            onClick={() => onDelete(client.id)}
                          >
                            <Trash2 className="w-4 h-4" /> Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <h3 className="font-semibold text-foreground text-sm mb-1 truncate uppercase tracking-tighter">
                    {client.name}
                  </h3>
                  <div className="space-y-1.5 mt-3">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 text-primary/40" />
                      <span className="truncate font-medium">
                        {client.email || <span className="text-muted-foreground/40 font-normal">Non renseigné</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 text-primary/40" />
                      <span className="font-medium">{client.phone || "Non renseigné"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="truncate font-medium">
                        {client.address || <span className="text-muted-foreground/30">—</span>}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-secondary/30 px-4 py-2 border-t border-border/50 flex items-center justify-between">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">
                    Chiffre d'Affaires
                  </div>
                  <div className="font-semibold text-foreground text-sm tracking-tighter">
                    {formatCurrency(getClientPaidTotal(client.id))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {clients.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon={Users}
              title={searchQuery ? "Aucun client trouvé" : "Base clients vide"}
              description={
                searchQuery
                  ? "Aucun client ne correspond à votre recherche."
                  : "Ajoutez votre premier client pour commencer à générer des devis."
              }
              actionLabel={!searchQuery ? "Nouveau client" : undefined}
              onAction={!searchQuery ? onOpenAdd : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
