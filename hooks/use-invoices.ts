import { useState, useCallback } from 'react';
import { useStore, Invoice } from '@/lib/store';
import { toast } from 'sonner';

export function useInvoices() {
  const invoices = useStore(state => state.invoices);
  const setInvoices = useStore(state => state.setInvoices);
  const setQuotes = useStore(state => state.setQuotes);
  const setCreditNotes = useStore(state => state.setCreditNotes);
  const isDataLoaded = useStore(state => state.isDataLoaded);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchInvoices = useCallback(async () => {
    try {
      const response = await fetch('/api/invoices');
      if (!response.ok) throw new Error('Failed to fetch invoices');
      const data = await response.json();
      setInvoices(data);
    } catch (error) {
      toast.error('Erreur serveur (500): Impossible de charger les factures.');
    }
  }, [setInvoices]);

  const deleteInvoice = useCallback(async (id: string, deleteAssociatedQuote: boolean = false) => {
    if (isDeleting || isCancelling) return false;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteQuote: deleteAssociatedQuote }),
      });

      if (response.status === 403) {
        toast.error("Action refusée : Vous manquez de droits pour supprimer cette facture.");
        return false;
      }
      if (!response.ok) throw new Error('Delete failed');

      toast.success(deleteAssociatedQuote ? "Facture et devis associé supprimés" : "Facture supprimée");

      // Refresh related data if a quote was touched
      if (deleteAssociatedQuote) {
        const [updatedInvoices, updatedQuotes, updatedNotes] = await Promise.all([
            fetch('/api/invoices').then(res => res.json()),
            fetch('/api/quotes').then(res => res.json()),
            fetch('/api/credit-notes').then(res => res.json())
        ]);
        setInvoices(updatedInvoices);
        setQuotes(updatedQuotes);
        setCreditNotes(updatedNotes);
      } else {
        await fetchInvoices();
      }

      return true;
    } catch (error) {
      toast.error("Erreur lors de la suppression");
      return false;
    } finally {
      setIsDeleting(false);
      setIsCancelling(false);
    }
  }, [isDeleting, isCancelling, fetchInvoices, setInvoices, setQuotes, setCreditNotes]);

  return {
    invoices,
    isDataLoaded,
    isDeleting,
    isCancelling,
    setIsCancelling,
    fetchInvoices,
    deleteInvoice
  };
}
