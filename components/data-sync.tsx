"use client"

import * as React from "react"
import { useStore } from "@/lib/store"

export function DataSync() {
  const { setClients, setQuotes, setInvoices, setServices, setPayments, setSettings, setCreditNotes, setUser, isAuthenticated } = useStore()

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const responses = await Promise.all([
          fetch('/api/clients'),
          fetch('/api/quotes'),
          fetch('/api/invoices'),
          fetch('/api/services'),
          fetch('/api/payments'),
          fetch('/api/settings'),
          fetch('/api/credit-notes'),
          fetch('/api/auth/me')
        ]);

        // Only parse as JSON if the response is actually OK and JSON
        const results = await Promise.all(responses.map(async (res) => {
          if (!res.ok) {
            console.error(`[DataSync] API Error: ${res.url} - ${res.status}`);
            return { error: true };
          }
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
            return res.json();
          }
          return { error: true };
        }));

        const [clients, quotes, invoices, services, payments, settings, creditNotes, me] = results;

        if (clients && !clients.error) setClients(clients);
        if (quotes && !quotes.error) setQuotes(quotes);
        if (invoices && !invoices.error) setInvoices(invoices);
        if (services && !services.error) setServices(services);
        if (payments && !payments.error) setPayments(payments);
        if (settings && !settings.error) setSettings(settings);
        if (creditNotes && !creditNotes.error) setCreditNotes(creditNotes);
        if (me && !me.error && me.user) setUser(me.user);
      } catch (error) {
        console.error('[DataSync] Failed to sync data:', error);
      }
    };

    fetchData();
  }, [setClients, setQuotes, setInvoices, setServices, setPayments, setSettings, setCreditNotes, setUser, isAuthenticated]);

  return null;
}
