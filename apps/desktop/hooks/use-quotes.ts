import { useState, useCallback } from 'react';
import { useStore, Quote } from '@/lib/store';
import { toast } from 'sonner';

export function useQuotes() {
  const quotes = useStore(state => state.quotes);
  const setQuotes = useStore(state => state.setQuotes);
  const setInvoices = useStore(state => state.setInvoices);
  const isDataLoaded = useStore(state => state.isDataLoaded);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const fetchQuotes = useCallback(async () => {
    try {
      const response = await fetch('/api/quotes');
      if (!response.ok) throw new Error('Failed to fetch quotes');
      const data = await response.json();
      setQuotes(data);
    } catch (error) {
      toast.error('Erreur serveur (500): Impossible de charger les devis.');
    }
  }, [setQuotes]);

  const deleteQuote = useCallback(async (id: string) => {
    if (isDeleting) return false;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });

      if (response.status === 403) {
        toast.error("Action refusée : Vous manquez de droits pour supprimer ce devis.");
        return false;
      }
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Delete failed');
      }

      toast.success("Devis supprimé");
      await fetchQuotes();
      return true;
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la suppression");
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, fetchQuotes]);

  const convertToInvoice = useCallback(async (quoteId: string) => {
    if (isConverting) return false;
    setIsConverting(true);

    try {
      const response = await fetch('/api/quotes/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la conversion');
      }

      toast.success("Devis converti en facture avec succès");

      // Refresh data
      const [newQuotes, newInvoices] = await Promise.all([
        fetch('/api/quotes').then(res => res.json()),
        fetch('/api/invoices').then(res => res.json())
      ]);

      setQuotes(newQuotes);
      setInvoices(newInvoices);

      return true;
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la conversion");
      return false;
    } finally {
      setIsConverting(false);
    }
  }, [isConverting, setQuotes, setInvoices]);

  return {
    quotes,
    isDataLoaded,
    isDeleting,
    isConverting,
    fetchQuotes,
    deleteQuote,
    convertToInvoice
  };
}
