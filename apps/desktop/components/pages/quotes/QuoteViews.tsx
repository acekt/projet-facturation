"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  FileText,
  MoreVertical,
  Download,
  Printer,
  Trash2,
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

interface QuoteActionDropdownProps {
  quote: Quote;
  onPreview: (quote: Quote) => void;
  onDownloadPDF: (quote: Quote) => void;
  onEdit: (quoteId: string) => void;
  onConvertToInvoice: (quoteId: string) => void;
  onDelete: (quoteId: string) => void;
  isDownloading: string | null;
  canModify: boolean;
  canDelete: boolean;
}

function QuoteActionDropdown({
  quote,
  onPreview,
  onDownloadPDF,
  onEdit,
  onConvertToInvoice,
  onDelete,
  isDownloading,
  canModify,
  canDelete,
}: QuoteActionDropdownProps) {
  return (
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
        {quote.status !== "CONVERTI" && canModify && (
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
        {quote.status !== "CONVERTI" && canDelete && (
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
  );
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
  const isAdmin = user?.role === "admin";
  const isOperatorOrAdmin = isAdmin || user?.role === "user";

  const canModify = (quote: Quote) => {
    if (isAdmin) return true;
    if (user?.role === "user" && quote.created_by === user?.id) return true;
    return false;
  };

  const canDelete = (quote: Quote) => {
    if (isAdmin) return true;
    if (user?.role === "user" && quote.created_by === user?.id) return true;
    return false;
  };

  // ── 1. VUE TABLE ──────────────────────────────────────────────────────────
  if (viewFormat === "table") {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
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
                  <QuoteActionDropdown
                    quote={quote}
                    onPreview={onPreview}
                    onDownloadPDF={onDownloadPDF}
                    onEdit={onEdit}
                    onConvertToInvoice={onConvertToInvoice}
                    onDelete={onDelete}
                    isDownloading={isDownloading}
                    canModify={canModify(quote)}
                    canDelete={canDelete(quote)}
                  />
                </ActionsCell>
              </DataTableRow>
            ))}
            {quotes.length === 0 && (
              <DataTableRow>
                <DataTableCell colSpan={6} className="h-64 text-center">
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
                </DataTableCell>
              </DataTableRow>
            )}
          </DataTableBody>
        </DataTable>
      </div>
    );
  }

  // ── 2. VUE HORIZONTALE ─────────────────────────────────────────────────────
  if (viewFormat === "horizontal") {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        <div className="space-y-2">
          {quotes.map((quote, index) => (
            <motion.div
              key={quote.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card className="bg-card border-border hover:border-primary/30 transition-all shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">{quote.number}</span>
                        <StatusBadge variant={getQuoteStatusVariant(quote.status as any)} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{quote.clientName || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 md:gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Total TTC</p>
                      <p className="text-lg font-semibold text-foreground tracking-tighter">
                        {formatCurrency(quote.total)}
                      </p>
                    </div>
                    <QuoteActionDropdown
                      quote={quote}
                      onPreview={onPreview}
                      onDownloadPDF={onDownloadPDF}
                      onEdit={onEdit}
                      onConvertToInvoice={onConvertToInvoice}
                      onDelete={onDelete}
                      isDownloading={isDownloading}
                      canModify={canModify(quote)}
                      canDelete={canDelete(quote)}
                    />
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
                      <QuoteActionDropdown
                        quote={quote}
                        onPreview={onPreview}
                        onDownloadPDF={onDownloadPDF}
                        onEdit={onEdit}
                        onConvertToInvoice={onConvertToInvoice}
                        onDelete={onDelete}
                        isDownloading={isDownloading}
                        canModify={canModify(quote)}
                        canDelete={canDelete(quote)}
                      />
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
