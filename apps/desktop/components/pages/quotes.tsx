"use client";

import * as React from "react";
import { Plus, DownloadCloud } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
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
  const itemsPerPage = 10;

  const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);
  const [quoteToDeleteId, setQuoteToDeleteId] = React.useState<string | null>(null);
  const [isDownloading, setIsDownloading] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const filteredQuotes = React.useMemo(() => {
    return quotes.filter((quote) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (quote.number || "").toLowerCase().includes(q) ||
        (quote.clientName || "").toLowerCase().includes(q);

      if (statusFilter === "all") return matchesSearch;
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
              onClick={async () => {
                try {
                  await exportQuotesToExcel(quotes);
                } catch (err) {
                  console.error("Export Excel failed:", err);
                  toast.error("Erreur lors de la génération du fichier Excel.");
                }
              }}
              className="gap-2 hidden sm:flex"
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

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1">
          <SearchBar
            placeholder="Rechercher un devis (numéro, client, objet)..."
            value={searchQuery}
            onChange={setSearchQuery}
            viewFormatKey="quotes"
          />
        </div>
        <div className="w-full sm:w-60">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full bg-secondary border-border text-foreground">
              <SelectValue placeholder="Filtrer par statut..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="EN_ATTENTE">En attente</SelectItem>
              <SelectItem value="ENVOYE">Envoyé</SelectItem>
              <SelectItem value="CONVERTI">Converti en facture</SelectItem>
              <SelectItem value="REFUSE">Refusé</SelectItem>
              <SelectItem value="EXPIRE">Expiré</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
    </div>
  );
}
