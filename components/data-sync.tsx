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
          isAuthenticated ? fetch('/api/auth/me') : Promise.resolve({ ok: false, error: true })
        ]);

        // Only parse as JSON if the response is actually OK and JSON
        const results = await Promise.all(responses.map(async (res) => {
          if (!res.ok) {
            // Don't log error for mock response (when not authenticated)
            if (!('url' in res) && !('status' in res)) {
              return { error: true };
            }
            const url = 'url' in res ? res.url : 'unknown';
            const status = 'status' in res ? res.status : 'unknown';
            console.error(`[DataSync] API Error: ${url} - ${status}`);
            return { error: true, status };
          }
          if (!('json' in res)) {
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
        
        // Handle auth/me response
        if (me && !me.error) {
          if (me.user) {
            setUser(me.user);
          } else if (me.error === 'User not found' || me.status === 404) {
            // User not found in database, clear session and redirect to login
            console.error('[DataSync] User not found, clearing session');
            window.location.href = '/login';
          }
        }
      } catch (error) {
        console.error('[DataSync] Failed to sync data:', error);
      }
    };

    fetchData();
  }, [setClients, setQuotes, setInvoices, setServices, setPayments, setSettings, setCreditNotes, setUser, isAuthenticated]);

  return null;
}
