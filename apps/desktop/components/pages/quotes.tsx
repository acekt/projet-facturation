"use client";

import * as React from "react";
import { Plus, DownloadCloud } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { cn, formatCurrency } from "@/lib/utils";
import { isPendingQuote } from "@/lib/utils/counters";
import { useStore, type Quote, type Invoice } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { getErrorMessage } from "@/lib/utils/action-error";
import { toast } from "sonner";
import { exportQuotesToExcel } from "@/lib/services/ExportService";
import { getQuotes, deleteQuote, convertQuoteToInvoice } from "@/app/actions/quote.actions";
import { getInvoices } from "@/app/actions/invoice.actions";
import { FullScreenDocumentViewer } from "@/components/fullscreen-document-viewer";
import { CreationSuccessModal } from "@/components/features/common/CreationSuccessModal";
import { Pagination } from "@workspace/ui/components/pagination-custom";
import { PageHeader } from "@/components/features/common/PageHeader";
import { SearchBar } from "@workspace/ui/components/search-bar";
import { QuoteDeleteDialog } from "./quotes/QuoteDeleteDialog";
import { QuoteDetailsDialog } from "./quotes/QuoteDetailsDialog";
import { QuoteViews } from "./quotes/QuoteViews";
import { DataExportModal } from "@/components/features/export/DataExportModal";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

interface QuotesPageProps {
  onCreateQuote: (id?: string) => void;
}

export function QuotesPage({ onCreateQuote }: QuotesPageProps) {
  const {
    quotes,
    setQuotes,
    setInvoices,
    settings,
    user,
    viewFormat,
    isDataLoaded,
  } = useStore(
    useShallow((state) => ({
      quotes: state.quotes,
      setQuotes: state.setQuotes,
      setInvoices: state.setInvoices,
      settings: state.settings,
      user: state.user,
      viewFormat: state.viewFormat,
      isDataLoaded: state.isDataLoaded,
    }))
  );

  const [searchQuery, setSearchQuery] = React.useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 200);
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 9; // Harmonisation Grille 3x3

  const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);
  const [quoteForDetails, setQuoteForDetails] = React.useState<Quote | null>(null);
  const [quoteToDeleteId, setQuoteToDeleteId] = React.useState<string | null>(null);
  const [isDownloading, setIsDownloading] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [convertedInvoiceModalData, setConvertedInvoiceModalData] = React.useState<{
    invoice: Invoice;
    quoteNumber: string;
  } | null>(null);
  const [previewInvoice, setPreviewInvoice] = React.useState<Invoice | null>(null);

  const quoteCounts = React.useMemo(() => {
    let draft = 0, pending = 0, converted = 0, refusedExpired = 0;
    const now = new Date();
    for (const q of quotes) {
      if (q.deletedAt) continue;
      const st = (q.status as string || "").toUpperCase();
      const isExpired = q.validUntil && st !== "CONVERTI" && new Date(q.validUntil) < now;
      if (st === "DRAFT" || st === "BROUILLON") draft++;
      else if (st === "CONVERTI") converted++;
      else if (st === "REFUSE" || st === "EXPIRE" || st === "EXPIRED" || isExpired) refusedExpired++;
      else if (isPendingQuote(q)) pending++;
    }
    return { draft, pending, converted, refusedExpired };
  }, [quotes]);

  const filteredQuotes = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return quotes.filter((quote) => {
      if (quote.deletedAt) return false;
      const matchesSearch =
        (quote.number || "").toLowerCase().includes(q) ||
        (quote.clientName || "").toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (statusFilter === "all") return true;

      const isExpired = quote.validUntil && quote.status !== "CONVERTI" && new Date(quote.validUntil) < new Date();

      if (statusFilter === "draft") {
        return (quote.status as string) === "draft" || (quote.status as string) === "BROUILLON";
      }
      if (statusFilter === "pending") {
        return isPendingQuote(quote);
      }
      if (statusFilter === "CONVERTI") {
        return quote.status === "CONVERTI";
      }
      if (statusFilter === "refused_expired") {
        return isExpired || quote.status === "REFUSE" || quote.status === "EXPIRE" || (quote.status as string) === "EXPIRED";
      }
      return quote.status === statusFilter;
    });
  }, [quotes, debouncedSearch, statusFilter]);

  const totalPages = Math.ceil(filteredQuotes.length / itemsPerPage) || 1;
  const safePage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedQuotes = filteredQuotes.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  );

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const handleDelete = async (id: string) => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const response = await deleteQuote(id);
      if (!response.success) throw new Error(response.error || "Delete failed");
      toast.success("Devis supprimé");
      setQuoteToDeleteId(null);
      const updatedQuotes = await getQuotes();
      if (updatedQuotes.success && updatedQuotes.data) {
        setQuotes(updatedQuotes.data);
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadPDF = async (quote: Quote) => {
    if (window.electron?.exportPDF) {
      setSelectedQuote(quote);
      return;
    }

    const toastId = toast.loading("Génération du PDF...");
    try {
      setIsDownloading(quote.id);
      const { pdf } = await import("@react-pdf/renderer");
      const { PDFDocument } = await import("@/components/pdf-document");
      const blob = await pdf(
        <PDFDocument document={quote} type="devis" settings={settings} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `DEVIS_${quote.number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Téléchargement démarré", { id: toastId });
    } catch (error) {
      console.error("PDF Error:", error);
      toast.error("Erreur lors de la génération du PDF", { id: toastId });
    } finally {
      setIsDownloading(null);
    }
  };

  const handleConvertToInvoice = async (quoteId: string) => {
    try {
      const targetQuote = quotes.find((q) => q.id === quoteId);
      const response = await convertQuoteToInvoice(quoteId);
      if (!response.success || !response.data) {
        throw new Error(response.error || "Conversion failed");
      }

      toast.success("Devis converti en facture avec succès");
      const [newQuotes, newInvoices] = await Promise.all([
        getQuotes(),
        getInvoices(),
      ]);

      if (newQuotes.success && newQuotes.data) setQuotes(newQuotes.data);
      if (newInvoices.success && newInvoices.data) {
        setInvoices(newInvoices.data);
        void useStore.getState().refreshStockData(true);
        useStore.getState().invalidateLedgerCache();
        const createdInv = newInvoices.data.find((inv) => inv.id === response.data?.invoiceId);
        if (createdInv) {
          setConvertedInvoiceModalData({
            invoice: createdInv,
            quoteNumber: targetQuote?.number || "DEVIS",
          });
        }
      }
    } catch (error: unknown) {
      toast.error(`Erreur: ${getErrorMessage(error)}`);
    }
  };

  if (!isDataLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Chargement des devis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 pb-4 border-b border-border bg-background z-10 space-y-4">
        <PageHeader
          title="Devis"
          description="Gérez vos propositions commerciales et proformas"
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => setIsExportModalOpen(true)}
                className="gap-2 hidden sm:flex cursor-pointer"
              >
                <DownloadCloud className="w-4 h-4" />
                Export Excel
              </Button>
              {(user?.role === "user" || user?.role === "admin") && (
                <Button
                  onClick={() => onCreateQuote()}
                  variant="primary-shadow"
                  className="gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Nouveau devis
                </Button>
              )}
            </>
          }
        />

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchBar
              placeholder="Rechercher un devis (numéro, client, objet)..."
              value={searchQuery}
              onChange={setSearchQuery}
              viewFormatKey="quotes"
            />
          </div>
        </div>

        {/* Filtres d'accès rapide unifiés (Loi de Hick, Fitts & Seuil de Doherty) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
              statusFilter === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            <span>Tous</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
                statusFilter === "all"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background/80 text-foreground"
              )}
            >
              {quotes.filter((q) => !q.deletedAt).length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("draft")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
              statusFilter === "draft"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            <span>Brouillons</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
                statusFilter === "draft"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background/80 text-foreground"
              )}
            >
              {quoteCounts.draft}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
              statusFilter === "pending"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            <span>En attente</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
                statusFilter === "pending"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background/80 text-foreground"
              )}
            >
              {quoteCounts.pending}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("CONVERTI")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
              statusFilter === "CONVERTI"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            <span>Convertis</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
                statusFilter === "CONVERTI"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background/80 text-foreground"
              )}
            >
              {quoteCounts.converted}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("refused_expired")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
              statusFilter === "refused_expired"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            <span>Refusés / Expirés</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
                statusFilter === "refused_expired"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background/80 text-foreground"
              )}
            >
              {quoteCounts.refusedExpired}
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pt-4 pr-1 space-y-4">
        <QuoteViews
          quotes={paginatedQuotes}
          viewFormat={viewFormat.quotes || "table"}
          user={user}
          searchQuery={searchQuery}
          isDownloading={isDownloading}
          onViewDetails={(q) => setQuoteForDetails(q)}
          onPreview={(q) => setSelectedQuote(q)}
          onDownloadPDF={handleDownloadPDF}
          onEdit={(id) => onCreateQuote(id)}
          onConvertToInvoice={handleConvertToInvoice}
          onDelete={(id) => setQuoteToDeleteId(id)}
          onCreateQuote={() => onCreateQuote()}
        />
      </div>

      <div className="shrink-0 pt-3 border-t border-border bg-background">
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      <QuoteDetailsDialog
        isOpen={Boolean(quoteForDetails)}
        onOpenChange={(open) => !open && setQuoteForDetails(null)}
        quote={quoteForDetails}
        onOpenPreview={(q) => {
          setQuoteForDetails(null);
          setSelectedQuote(q);
        }}
        onConvertToInvoice={handleConvertToInvoice}
      />

      <QuoteDeleteDialog
        quoteId={quoteToDeleteId}
        onOpenChange={(open) => !open && setQuoteToDeleteId(null)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />

      {selectedQuote && (
        <FullScreenDocumentViewer
          data={selectedQuote}
          type="devis"
          title={`Devis N° ${selectedQuote.number}`}
          onClose={() => setSelectedQuote(null)}
        />
      )}

      {previewInvoice && (
        <FullScreenDocumentViewer
          data={previewInvoice}
          type="facture"
          title={`Facture N° ${previewInvoice.number}`}
          onClose={() => setPreviewInvoice(null)}
        />
      )}

      {convertedInvoiceModalData && (
        <CreationSuccessModal
          isOpen={Boolean(convertedInvoiceModalData)}
          onOpenChange={(open) => {
            if (!open) setConvertedInvoiceModalData(null);
          }}
          title="Facture générée avec succès"
          subtitle={`Le devis ${convertedInvoiceModalData.quoteNumber} a été converti en facture active avec succès.`}
          details={[
            {
              label: "Numéro de facture",
              value: (
                <span className="font-mono font-bold text-foreground">
                  {convertedInvoiceModalData.invoice.number}
                </span>
              ),
            },
            {
              label: "Devis d'origine",
              value: (
                <span className="font-mono font-medium text-foreground">
                  {convertedInvoiceModalData.quoteNumber}
                </span>
              ),
            },
            {
              label: "Client destinataire",
              value: convertedInvoiceModalData.invoice.clientName || "—",
            },
            {
              label: "Total TTC",
              value: formatCurrency(convertedInvoiceModalData.invoice.total),
              isAmount: true,
            },
          ]}
          onClose={() => setConvertedInvoiceModalData(null)}
          onPreview={() => {
            const inv = convertedInvoiceModalData.invoice;
            setConvertedInvoiceModalData(null);
            setPreviewInvoice(inv);
          }}
          previewLabel="Aperçu Facture"
        />
      )}

      <DataExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        defaultScope="quotes"
      />
    </div>
  );
}
