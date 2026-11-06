"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  FileText,
  MoreVertical,
  Download,
  Info,
  Trash2,
  CheckCircle2,
  Eye,
  Edit2,
  Calendar,
  Send,
} from "lucide-react";
import { ShareDocumentModal } from "@/components/features/share/ShareDocumentModal";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  onViewDetails: (quote: Quote) => void;
  onPreview: (quote: Quote) => void;
  onDownloadPDF: (quote: Quote) => void;
  onEdit: (quoteId: string) => void;
  onConvertToInvoice: (quoteId: string) => void;
  onDelete: (quoteId: string) => void;
  onCreateQuote: () => void;
}

interface QuoteActionDropdownProps {
  quote: Quote;
  onViewDetails: (quote: Quote) => void;
  onPreview: (quote: Quote) => void;
  onDownloadPDF: (quote: Quote) => void;
  onEdit: (quoteId: string) => void;
  onConvertToInvoice: (quoteId: string) => void;
  onDelete: (quoteId: string) => void;
  onShare?: (quote: Quote) => void;
  isDownloading: string | null;
  canModify: boolean;
  canDelete: boolean;
}

function QuoteActionDropdown({
  quote,
  onViewDetails,
  onPreview,
  onDownloadPDF,
  onEdit,
  onConvertToInvoice,
  onDelete,
  onShare,
  isDownloading,
  canModify,
  canDelete,
}: QuoteActionDropdownProps) {
  const isConverted = quote.status === "CONVERTI";
  const isExpired = quote.status === "EXPIRED" || quote.status === "EXPIRE";
  const hasBusinessActions = !isConverted && canModify;
  const canDeleteQuote = !isConverted && canDelete;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer">
          <MoreVertical className="w-4 h-4" />
          <span className="sr-only">Actions du devis</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-card border-border shadow-lg p-1.5 rounded-xl">
        {/* Groupe 1 : Consultation & Diffusion */}
        <DropdownMenuItem className="gap-2.5 cursor-pointer font-medium" onClick={() => setTimeout(() => onViewDetails(quote), 0)}>
          <Info className="w-4 h-4 text-primary" /> Voir les détails
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => setTimeout(() => onPreview(quote), 0)}>
          <Eye className="w-4 h-4 text-muted-foreground" /> Aperçu du document (A4)
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2.5 cursor-pointer"
          onClick={() => onDownloadPDF(quote)}
          disabled={isDownloading === quote.id}
        >
          <Download className="w-4 h-4 text-muted-foreground" />
          {isDownloading === quote.id ? "Génération..." : "Télécharger PDF"}
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => setTimeout(() => onShare?.(quote), 0)}>
          <Send className="w-4 h-4 text-primary" /> Partager (WhatsApp / Email)
        </DropdownMenuItem>

        {/* Groupe 2 : Gestion Métier */}
        {hasBusinessActions && (
          <>
            <DropdownMenuSeparator className="my-1 bg-border/60" />
            <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => onEdit(quote.id)}>
              <Edit2 className="w-4 h-4 text-muted-foreground" /> Modifier le devis
            </DropdownMenuItem>
            {!isExpired && (
              <DropdownMenuItem
                className="gap-2.5 cursor-pointer font-medium"
                onClick={() => onConvertToInvoice(quote.id)}
              >
                <CheckCircle2 className="w-4 h-4 text-primary" /> Convertir en facture
              </DropdownMenuItem>
            )}
          </>
        )}

        {/* Groupe 3 : Suppression */}
        {canDeleteQuote && (
          <>
            <DropdownMenuSeparator className="my-1 bg-border/60" />
            <DropdownMenuItem
              className="gap-2.5 cursor-pointer text-destructive focus:text-destructive"
              onClick={() => setTimeout(() => onDelete(quote.id), 0)}
            >
              <Trash2 className="w-4 h-4 text-destructive" /> Supprimer
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
  onViewDetails,
  onPreview,
  onDownloadPDF,
  onEdit,
  onConvertToInvoice,
  onDelete,
  onCreateQuote,
}: QuoteViewsProps) {
  const [sharingQuote, setSharingQuote] = React.useState<Quote | null>(null);
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

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [quotes]);

  // ── 1. VUE TABLE ──────────────────────────────────────────────────────────
  if (viewFormat === "table") {
    return (
      <>
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 pr-1">
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Devis</DataTableHeaderCell>
              <DataTableHeaderCell className="min-w-[180px]">Client</DataTableHeaderCell>
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
                <DataTableCell className="min-w-[180px] max-w-[320px] truncate" title={quote.clientName || "—"}>
                  <span className="font-medium text-foreground">{quote.clientName || "—"}</span>
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
                    onViewDetails={onViewDetails}
                    onPreview={onPreview}
                    onDownloadPDF={onDownloadPDF}
                    onEdit={onEdit}
                    onConvertToInvoice={onConvertToInvoice}
                    onDelete={onDelete}
                    onShare={setSharingQuote}
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
      {sharingQuote && (
        <ShareDocumentModal
          open={!!sharingQuote}
          onOpenChange={(open) => !open && setSharingQuote(null)}
          document={sharingQuote}
          type="quote"
        />
      )}
      </>
    );
  }

  // ── 2. VUE HORIZONTALE ─────────────────────────────────────────────────────
  if (viewFormat === "horizontal") {
    return (
      <>
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 pr-1">
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
                      onViewDetails={onViewDetails}
                      onPreview={onPreview}
                      onDownloadPDF={onDownloadPDF}
                      onEdit={onEdit}
                      onConvertToInvoice={onConvertToInvoice}
                      onDelete={onDelete}
                      onShare={setSharingQuote}
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
      {sharingQuote && (
        <ShareDocumentModal
          open={!!sharingQuote}
          onOpenChange={(open) => !open && setSharingQuote(null)}
          document={sharingQuote}
          type="quote"
        />
      )}
      </>
    );
  }

  // ── 3. VUE BLOC / CARTES ───────────────────────────────────────────────────
  return (
    <>
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
                        onViewDetails={onViewDetails}
                        onPreview={onPreview}
                        onDownloadPDF={onDownloadPDF}
                        onEdit={onEdit}
                        onConvertToInvoice={onConvertToInvoice}
                        onDelete={onDelete}
                        onShare={setSharingQuote}
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
                  <div className="font-semibold text-foreground text-sm tabular-nums">{formatCurrency(quote.total)}</div>
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
    {sharingQuote && (
      <ShareDocumentModal
        open={!!sharingQuote}
        onOpenChange={(open) => !open && setSharingQuote(null)}
        document={sharingQuote}
        type="quote"
      />
    )}
    </>
  );
}
