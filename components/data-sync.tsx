"use client"

import * as React from "react"
import { useStore } from "@/lib/store"

export function DataSync() {
  const { setClients, setQuotes, setInvoices, setSettings } = useStore()

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [clients, quotes, invoices, settings] = await Promise.all([
          fetch('/api/clients').then(res => res.json()),
          fetch('/api/quotes').then(res => res.json()),
          fetch('/api/invoices').then(res => res.json()),
          fetch('/api/settings').then(res => res.json())
        ]);

        if (!clients.error) setClients(clients);
        if (!quotes.error) setQuotes(quotes);
        if (!invoices.error) setInvoices(invoices);
        if (!settings.error) setSettings(settings);
      } catch (error) {
        console.error('Failed to sync data:', error);
      }
    };

    fetchData();
  }, [setClients, setQuotes, setInvoices, setSettings]);

  return null;
}
