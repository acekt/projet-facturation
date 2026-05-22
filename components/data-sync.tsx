"use client"

import * as React from "react"
import { useStore } from "@/lib/store"

export function DataSync() {
  const { setClients, setQuotes, setInvoices, setServices, setPayments, setSettings, setCreditNotes } = useStore()

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [clients, quotes, invoices, services, payments, settings, creditNotes] = await Promise.all([
          fetch('/api/clients').then(res => res.json()),
          fetch('/api/quotes').then(res => res.json()),
          fetch('/api/invoices').then(res => res.json()),
          fetch('/api/services').then(res => res.json()),
          fetch('/api/payments').then(res => res.json()),
          fetch('/api/settings').then(res => res.json()),
          fetch('/api/credit-notes').then(res => res.json())
        ]);

        if (!clients.error) setClients(clients);
        if (!quotes.error) setQuotes(quotes);
        if (!invoices.error) setInvoices(invoices);
        if (!services.error) setServices(services);
        if (!payments.error) setPayments(payments);
        if (!settings.error) setSettings(settings);
        if (!creditNotes.error) setCreditNotes(creditNotes);
      } catch (error) {
        console.error('Failed to sync data:', error);
      }
    };

    fetchData();
  }, [setClients, setQuotes, setInvoices, setSettings]);

  return null;
}
