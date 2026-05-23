"use client"

import * as React from "react"
import { useStore } from "@/lib/store"

export function DataSync() {
  const { setClients, setQuotes, setInvoices, setServices, setPayments, setSettings, setCreditNotes } = useStore()

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const safeFetch = async (url: string) => {
          try {
            const res = await fetch(url);
            if (!res.ok) return [];
            const data = await res.json();
            return data;
          } catch (error) {
            console.error(`Error fetching ${url}:`, error);
            return [];
          }
        };

        const [clients, quotes, invoices, services, payments, settings, creditNotes] = await Promise.all([
          safeFetch('/api/clients'),
          safeFetch('/api/quotes'),
          safeFetch('/api/invoices'),
          safeFetch('/api/services'),
          safeFetch('/api/payments'),
          safeFetch('/api/settings'),
          safeFetch('/api/credit-notes')
        ]);

        if (Array.isArray(clients)) setClients(clients);
        if (Array.isArray(quotes)) setQuotes(quotes);
        if (Array.isArray(invoices)) setInvoices(invoices);
        if (Array.isArray(services)) setServices(services);
        if (Array.isArray(payments)) setPayments(payments);
        if (settings) setSettings(settings);
        if (Array.isArray(creditNotes)) setCreditNotes(creditNotes);
      } catch (error) {
        console.error('Failed to sync data:', error);
      }
    };

    fetchData();
  }, [setClients, setQuotes, setInvoices, setServices, setPayments, setSettings, setCreditNotes]);

  return null;
}
