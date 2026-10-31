"use client";

import * as React from "react";
import { Plus, DownloadCloud } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@/lib/utils";
import { useStore, type Quote } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { getErrorMessage } from "@/lib/utils/action-error";
import { toast } from "sonner";
import { exportQuotesToExcel } from "@/lib/services/ExportService";
import { getQuotes, deleteQuote, convertQuoteToInvoice } from "@/app/actions/quote.actions";
import { getInvoices } from "@/app/actions/invoice.actions";
import { FullScreenDocumentViewer } from "@/components/fullscreen-document-viewer";
import { Pagination } from "@workspace/ui/components/pagination-custom";
import { PageHeader } from "@workspace/ui/components/page-header";
import { SearchBar } from "@workspace/ui/components/search-bar";
import { QuoteDeleteDialog } from "./quotes/QuoteDeleteDialog";
import { QuoteViews } from "./quotes/QuoteViews";
import { DataExportModal } from "@/components/features/export/DataExportModal";

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
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 9; // Harmonisation Grille 3x3

  const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);
  const [quoteToDeleteId, setQuoteToDeleteId] = React.useState<string | null>(null);
  const [isDownloading, setIsDownloading] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const quoteCounts = React.useMemo(() => {
    let draft = 0, pending = 0, converted = 0, refusedExpired = 0;
    for (const q of quotes) {
      if (q.deletedAt) continue;
      const st = q.status as string;
      if (st === "draft" || st === "BROUILLON") draft++;
      else if (st === "CONVERTI") converted++;
      else if (st === "REFUSE" || st === "EXPIRE" || st === "EXPIRED") refusedExpired++;
      else pending++;
    }
    return { draft, pending, converted, refusedExpired };
  }, [quotes]);

  const filteredQuotes = React.useMemo(() => {
    return quotes.filter((quote) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (quote.number || "").toLowerCase().includes(q) ||
        (quote.clientName || "").toLowerCase().includes(q);

      if (statusFilter === "all") return matchesSearch;
      if (statusFilter === "draft") {
        return matchesSearch && ((quote.status as string) === "draft" || (quote.status as string) === "BROUILLON");
      }
      if (statusFilter === "pending") {
        return matchesSearch && (quote.status === "EN_ATTENTE" || (quote.status as string) === "ENVOYE" || (quote.status as string) === "sent");
      }
      if (statusFilter === "CONVERTI") {
        return matchesSearch && quote.status === "CONVERTI";
      }
      if (statusFilter === "refused_expired") {
        return matchesSearch && (quote.status === "REFUSE" || quote.status === "EXPIRE" || (quote.status as string) === "EXPIRED");
      }
      return matchesSearch && quote.status === statusFilter;
    });
  }, [quotes, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredQuotes.length / itemsPerPage);
  const paginatedQuotes = filteredQuotes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
      const response = await convertQuoteToInvoice(quoteId);
      if (!response.success) {
        throw new Error(response.error || "Conversion failed");
      }

      toast.success("Devis converti en facture avec succès");
      const [newQuotes, newInvoices] = await Promise.all([
        getQuotes(),
        getInvoices(),
      ]);

      if (newQuotes.success && newQuotes.data) setQuotes(newQuotes.data);
      if (newInvoices.success && newInvoices.data) setInvoices(newInvoices.data);
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
    <div className="flex-1 flex flex-col overflow-hidden space-y-6">
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
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Nouveau devis
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 mb-2">
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
      <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
            statusFilter === "all"
              ? "bg-secondary text-foreground shadow-xs"
              : "text-muted-foreground hover:bg-secondary/60"
          )}
        >
          <span>Tous</span>
          <span className="text-[11px] tabular-nums font-normal opacity-80">({quotes.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("draft")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
            statusFilter === "draft"
              ? "bg-slate-800 text-white shadow-xs"
              : "bg-slate-500/10 text-slate-700 dark:text-slate-300 hover:bg-slate-500/20"
          )}
        >
          <span>Brouillons</span>
          <span className="px-1.5 py-0.5 bg-slate-500/20 rounded-full tabular-nums text-[10px] font-bold">
            {quoteCounts.draft}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("pending")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
            statusFilter === "pending"
              ? "bg-amber-500 text-white shadow-xs"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
          )}
        >
          <span>En attente</span>
          <span className="px-1.5 py-0.5 bg-amber-600/20 rounded-full tabular-nums text-[10px] font-bold">
            {quoteCounts.pending}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("CONVERTI")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
            statusFilter === "CONVERTI"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-muted-foreground hover:bg-secondary/60"
          )}
        >
          <span>Convertis</span>
          <span className="px-1.5 py-0.5 bg-emerald-700/20 rounded-full tabular-nums text-[10px] font-bold">
            {quoteCounts.converted}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("refused_expired")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
            statusFilter === "refused_expired"
              ? "bg-slate-700 text-white shadow-xs"
              : "text-muted-foreground hover:bg-secondary/60"
          )}
        >
          <span>Refusés / Expirés</span>
          <span className="px-1.5 py-0.5 bg-slate-500/20 rounded-full tabular-nums text-[10px] font-bold">
            {quoteCounts.refusedExpired}
          </span>
        </button>
      </div>

      <QuoteViews
        quotes={paginatedQuotes}
        viewFormat={viewFormat.quotes || "table"}
        user={user}
        searchQuery={searchQuery}
        isDownloading={isDownloading}
        onPreview={(q) => setSelectedQuote(q)}
        onDownloadPDF={handleDownloadPDF}
        onEdit={(id) => onCreateQuote(id)}
        onConvertToInvoice={handleConvertToInvoice}
        onDelete={(id) => setQuoteToDeleteId(id)}
        onCreateQuote={() => onCreateQuote()}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
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

      <DataExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        defaultScope="quotes"
      />
    </div>
  );
}
