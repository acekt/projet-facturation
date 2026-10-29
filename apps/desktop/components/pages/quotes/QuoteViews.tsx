"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  FileText,
  MoreVertical,
  Download,
  Printer,
  Trash2,
  Clock,
  CheckCircle2,
  Eye,
  Edit2,
  Calendar,
} from "lucide-react";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  StatusBadge,
  getQuoteStatusVariant,
} from "@workspace/ui/components/status-badge";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Quote, User } from "@/lib/store";

interface QuoteViewsProps {
  quotes: Quote[];
  viewFormat: "table" | "horizontal" | "block";
  user: User | null;
  searchQuery: string;
  isDownloading: string | null;
  onPreview: (quote: Quote) => void;
  onDownloadPDF: (quote: Quote) => void;
  onEdit: (quoteId: string) => void;
  onConvertToInvoice: (quoteId: string) => void;
  onDelete: (quoteId: string) => void;
  onCreateQuote: () => void;
}

export function QuoteViews({
  quotes,
  viewFormat,
  user,
  searchQuery,
  isDownloading,
  onPreview,
  onDownloadPDF,
  onEdit,
  onConvertToInvoice,
  onDelete,
  onCreateQuote,
}: QuoteViewsProps) {
  const isOperatorOrAdmin = user?.role === "user" || user?.role === "admin";
  const isAdmin = user?.role === "admin";

  const canModify = (q: Quote) =>
    isOperatorOrAdmin && (q.created_by === user?.id || isAdmin);

  // ── 1. VUE TABLEAU ──────────────────────────────────────────────────────────
  if (!viewFormat || viewFormat === "table") {
    return (
      <>
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Devis</DataTableHeaderCell>
              <DataTableHeaderCell>Client</DataTableHeaderCell>
              <DataTableHeaderCell>Date</DataTableHeaderCell>
              <DataTableHeaderCell>Statut</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Total</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {quotes.map((quote) => (
              <DataTableRow key={quote.id}>
                <DataTableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary/5 flex items-center justify-center text-primary flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-sm text-foreground">{quote.number}</span>
                  </div>
                </DataTableCell>
                <DataTableCell truncate title={quote.clientName || "—"}>
                  {quote.clientName || "—"}
                </DataTableCell>
                <DataTableCell>
                  <span className="text-xs text-muted-foreground">Émission : {formatDate(quote.date)}</span>
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge variant={getQuoteStatusVariant(quote.status as any)} />
                </DataTableCell>
                <AmountCell amount={quote.total} />
                <ActionsCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                      <DropdownMenuItem className="gap-2" onClick={() => onPreview(quote)}>
                        <Eye className="w-4 h-4" /> Aperçu
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2" onClick={() => onPreview(quote)}>
                        <Printer className="w-4 h-4" /> Imprimer
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => onDownloadPDF(quote)}
                        disabled={isDownloading === quote.id}
                      >
                        <Download className="w-4 h-4" />
                        {isDownloading === quote.id ? "Génération..." : "Télécharger PDF"}
                      </DropdownMenuItem>
                      {quote.status !== "CONVERTI" && canModify(quote) && (
                        <>
                          <DropdownMenuItem className="gap-2" onClick={() => onEdit(quote.id)}>
                            <Edit2 className="w-4 h-4" /> Modifier le devis
                          </DropdownMenuItem>
                          {quote.status !== "EXPIRED" && quote.status !== "EXPIRE" && (
                            <DropdownMenuItem
                              className="gap-2 text-primary font-medium"
                              onClick={() => onConvertToInvoice(quote.id)}
                            >
                              <CheckCircle2 className="w-4 h-4" /> Convertir en facture
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                      {quote.status !== "CONVERTI" && (isAdmin || (user?.role === "user" && quote.created_by === user?.id)) && (
                        <>
                          <div className="h-px bg-border my-1" />
                          <DropdownMenuItem
                            className="gap-2 text-destructive focus:text-destructive"
                            onClick={() => onDelete(quote.id)}
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
        {quotes.length === 0 && (
          <div className="p-8 text-center">
            <EmptyState
              icon={FileText}
              title={searchQuery ? "Aucun devis trouvé" : "Aucun devis"}
              description={
                searchQuery
                  ? "Aucun devis ne correspond à votre recherche."
                  : "Créez votre premier devis pour commencer."
              }
              actionLabel={!searchQuery && isOperatorOrAdmin ? "Nouveau devis" : undefined}
              onAction={!searchQuery && isOperatorOrAdmin ? onCreateQuote : undefined}
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
        <div className="grid grid-cols-1 gap-4">
          {quotes.map((quote, index) => (
            <motion.div
              key={quote.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-card border-border hover:border-primary/30 transition-all group shadow-sm">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-foreground text-sm">{quote.number}</h3>
                          <StatusBadge variant={getQuoteStatusVariant(quote.status as any)} />
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground/80 uppercase tracking-tighter">
                            {quote.clientName || "—"}
                          </span>
                          <span className="flex items-center gap-1 opacity-60">
                            <Clock className="w-3 h-3" />
                            Émission: {formatDate(quote.date)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 md:gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Total TTC</p>
                        <p className="text-lg font-semibold text-foreground tracking-tighter">
                          {formatCurrency(quote.total)}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                            <MoreVertical className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                          <DropdownMenuItem className="gap-2" onClick={() => onPreview(quote)}>
                            <Eye className="w-4 h-4" /> Aperçu
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2" onClick={() => onPreview(quote)}>
                            <Printer className="w-4 h-4" /> Imprimer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() => onDownloadPDF(quote)}
                            disabled={isDownloading === quote.id}
                          >
                            <Download className="w-4 h-4" />
                            {isDownloading === quote.id ? "Génération..." : "Télécharger PDF"}
                          </DropdownMenuItem>
                          {quote.status !== "CONVERTI" && canModify(quote) && (
                            <>
                              <DropdownMenuItem className="gap-2" onClick={() => onEdit(quote.id)}>
                                <Edit2 className="w-4 h-4" /> Modifier le devis
                              </DropdownMenuItem>
                              {quote.status !== "EXPIRED" && quote.status !== "EXPIRE" && (
                                <DropdownMenuItem
                                  className="gap-2 text-primary font-medium"
                                  onClick={() => onConvertToInvoice(quote.id)}
                                >
                                  <CheckCircle2 className="w-4 h-4" /> Convertir en facture
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                          {quote.status !== "CONVERTI" && (isAdmin || (user?.role === "user" && quote.created_by === user?.id)) && (
                            <>
                              <div className="h-px bg-border my-1" />
                              <DropdownMenuItem
                                className="gap-2 text-destructive focus:text-destructive"
                                onClick={() => onDelete(quote.id)}
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
            </motion.div>
          ))}
          {quotes.length === 0 && (
            <EmptyState
              icon={FileText}
              title={searchQuery ? "Aucun devis trouvé" : "Aucun devis"}
              description={
                searchQuery
                  ? "Aucun devis ne correspond à votre recherche."
                  : "Créez votre premier devis pour commencer."
              }
              actionLabel={!searchQuery && isOperatorOrAdmin ? "Nouveau devis" : undefined}
              onAction={!searchQuery && isOperatorOrAdmin ? onCreateQuote : undefined}
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
        {quotes.map((quote, index) => (
          <motion.div
            key={quote.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="bg-card border-border hover:border-primary/30 transition-all group overflow-hidden shadow-sm">
              <CardContent className="p-0">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge variant={getQuoteStatusVariant(quote.status as any)} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                            <MoreVertical className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                          <DropdownMenuItem className="gap-2" onClick={() => onPreview(quote)}>
                            <Eye className="w-4 h-4" /> Aperçu
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2" onClick={() => onPreview(quote)}>
                            <Printer className="w-4 h-4" /> Imprimer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() => onDownloadPDF(quote)}
                            disabled={isDownloading === quote.id}
                          >
                            <Download className="w-4 h-4" />
                            {isDownloading === quote.id ? "Génération..." : "Télécharger PDF"}
                          </DropdownMenuItem>
                          {quote.status !== "CONVERTI" && canModify(quote) && (
                            <>
                              <DropdownMenuItem className="gap-2" onClick={() => onEdit(quote.id)}>
                                <Edit2 className="w-4 h-4" /> Modifier le devis
                              </DropdownMenuItem>
                              {quote.status !== "EXPIRED" && quote.status !== "EXPIRE" && (
                                <DropdownMenuItem
                                  className="gap-2 text-primary font-medium"
                                  onClick={() => onConvertToInvoice(quote.id)}
                                >
                                  <CheckCircle2 className="w-4 h-4" /> Convertir en facture
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                          {quote.status !== "CONVERTI" && (isAdmin || (user?.role === "user" && quote.created_by === user?.id)) && (
                            <>
                              <div className="h-px bg-border my-1" />
                              <DropdownMenuItem
                                className="gap-2 text-destructive focus:text-destructive"
                                onClick={() => onDelete(quote.id)}
                              >
                                <Trash2 className="w-4 h-4" /> Supprimer
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">{quote.number}</h3>
                  <p className="text-xs text-muted-foreground mb-3 font-medium">{quote.clientName || "—"}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5 text-primary/40" />
                    <span>{formatDate(quote.date)}</span>
                  </div>
                </div>
                <div className="bg-secondary/30 px-4 py-2 border-t border-border/50 flex items-center justify-between">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Total TTC</div>
                  <div className="font-semibold text-foreground text-sm tracking-tighter">{formatCurrency(quote.total)}</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {quotes.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon={FileText}
              title={searchQuery ? "Aucun devis trouvé" : "Aucun devis"}
              description={
                searchQuery
                  ? "Aucun devis ne correspond à votre recherche."
                  : "Créez votre premier devis pour commencer."
              }
              actionLabel={!searchQuery && isOperatorOrAdmin ? "Nouveau devis" : undefined}
              onAction={!searchQuery && isOperatorOrAdmin ? onCreateQuote : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
