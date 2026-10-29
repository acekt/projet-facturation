"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { MoreVertical, Edit2, Trash2, Briefcase, Tag, Eye } from "lucide-react";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { EmptyState } from "@workspace/ui/components/empty-state";
import {
  DataTable,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableHeaderCell,
  DataTableCell,
  AmountCell,
  ActionsCell,
} from "@workspace/ui/components/data-table";
import { formatCurrency } from "@/lib/utils";
import type { Service, User } from "@/lib/store";

interface ServiceViewsProps {
  services: Service[];
  viewFormat: "table" | "horizontal" | "block";
  user: User | null;
  searchQuery: string;
  onViewDetails: (service: Service) => void;
  onEdit: (service: Service) => void;
  onDelete: (serviceId: string) => void;
  onOpenCreate: () => void;
}

export function ServiceViews({
  services,
  viewFormat,
  user,
  searchQuery,
  onViewDetails,
  onEdit,
  onDelete,
  onOpenCreate,
}: ServiceViewsProps) {
  const isAdmin = user?.role === "admin";

  // ── 1. VUE TABLEAU ──────────────────────────────────────────────────────────
  if (!viewFormat || viewFormat === "table") {
    return (
      <>
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Service</DataTableHeaderCell>
              <DataTableHeaderCell>Catégorie</DataTableHeaderCell>
              <DataTableHeaderCell>Description</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Prix unitaire</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {services.map((service) => (
              <DataTableRow key={service.id}>
                <DataTableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary/5 flex items-center justify-center text-primary flex-shrink-0">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <span
                      className="font-medium text-sm text-foreground max-w-[200px] sm:max-w-[300px] truncate"
                      title={service.name}
                    >
                      {service.name}
                    </span>
                  </div>
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge
                    variant="neutral"
                    label={service.category || "Non classé"}
                    className="max-w-[150px] truncate"
                  />
                </DataTableCell>
                <DataTableCell truncate title={service.description || undefined}>
                  {service.description || <span className="text-muted-foreground/50">—</span>}
                </DataTableCell>
                <AmountCell amount={service.unitPrice} />
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
                        onClick={() => onViewDetails(service)}
                      >
                        <Eye className="w-4 h-4 text-primary" /> Voir les détails
                      </DropdownMenuItem>
                      {isAdmin && (
                        <>
                          <DropdownMenuSeparator className="bg-border/60" />
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onEdit(service)}>
                            <Edit2 className="w-4 h-4" /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                            onClick={() => onDelete(service.id)}
                          >
                            <Trash2 className="w-4 h-4" /> Supprimer
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ActionsCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
        {services.length === 0 && (
          <div className="p-8 text-center">
            <EmptyState
              icon={Briefcase}
              title={searchQuery ? "Aucun service trouvé" : "Catalogue vide"}
              description={
                searchQuery
                  ? "Aucun service ne correspond à votre recherche dans le catalogue."
                  : "Enregistrez vos prestations habituelles pour gagner du temps lors de la création de devis."
              }
              actionLabel={!searchQuery && isAdmin ? "Nouveau service" : undefined}
              onAction={!searchQuery && isAdmin ? onOpenCreate : undefined}
            />
          </div>
        )}
      </>
    );
  }

  // ── 2. VUE HORIZONTALE ──────────────────────────────────────────────────────
  if (viewFormat === "horizontal") {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        <div className="space-y-3">
          {services.map((service) => (
            <Card key={service.id} className="bg-card border-border hover:border-primary/30 transition-all group shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{service.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge variant="neutral" label={service.category || "Non classé"} />
                        <span className="text-xs text-muted-foreground">{formatCurrency(service.unitPrice)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-lg">
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer font-medium"
                          onClick={() => onViewDetails(service)}
                        >
                          <Eye className="w-4 h-4 text-primary" /> Voir les détails
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuSeparator className="bg-border/60" />
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onEdit(service)}>
                              <Edit2 className="w-4 h-4" /> Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                              onClick={() => onDelete(service.id)}
                            >
                              <Trash2 className="w-4 h-4" /> Supprimer
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {services.length === 0 && (
            <EmptyState
              icon={Briefcase}
              title={searchQuery ? "Aucun service trouvé" : "Catalogue vide"}
              description={
                searchQuery
                  ? "Aucun service ne correspond à votre recherche dans le catalogue."
                  : "Enregistrez vos prestations habituelles pour gagner du temps lors de la création de devis."
              }
              actionLabel={!searchQuery && isAdmin ? "Nouveau service" : undefined}
              onAction={!searchQuery && isAdmin ? onOpenCreate : undefined}
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
        {services.map((service, index) => (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="bg-card border-border hover:border-primary/30 transition-all group overflow-hidden shadow-sm">
              <CardContent className="p-0">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Briefcase className="w-5 h-5" />
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
                          onClick={() => onViewDetails(service)}
                        >
                          <Eye className="w-4 h-4 text-primary" /> Voir les détails
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuSeparator className="bg-border/60" />
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onEdit(service)}>
                              <Edit2 className="w-4 h-4" /> Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                              onClick={() => onDelete(service.id)}
                            >
                              <Trash2 className="w-4 h-4" /> Supprimer
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <h3 className="font-semibold text-foreground text-sm mb-1 truncate uppercase tracking-tighter">
                    {service.name}
                  </h3>
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-3 h-3 text-primary/40" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {service.category || "Non classé"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 h-8 mb-3 leading-relaxed">
                    {service.description || "Aucune description fournie."}
                  </p>
                </div>
                <div className="bg-secondary/30 px-4 py-2 border-t border-border/50 flex items-center justify-between">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">
                    Tarif Standard
                  </div>
                  <div className="font-semibold text-foreground text-sm tracking-tighter">
                    {formatCurrency(service.unitPrice)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {services.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon={Briefcase}
              title={searchQuery ? "Aucun service trouvé" : "Catalogue vide"}
              description={
                searchQuery
                  ? "Aucun service ne correspond à votre recherche dans le catalogue."
                  : "Enregistrez vos prestations habituelles pour gagner du temps lors de la création de devis."
              }
              actionLabel={!searchQuery && isAdmin ? "Nouveau service" : undefined}
              onAction={!searchQuery && isAdmin ? onOpenCreate : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
