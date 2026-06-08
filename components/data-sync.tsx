"use client"

import * as React from "react"
import { useStore } from "@/lib/store"

export function DataSync() {
  const { setClients, setQuotes, setInvoices, setServices, setPayments, setSettings, setCreditNotes, setUser, isAuthenticated } = useStore()

  React.useEffect(() => {
    let isMounted = true;

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

        if (!isMounted) return;

        // Only parse as JSON if the response is actually OK and JSON
        const results = await Promise.all(responses.map(async (res) => {
          try {
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
              console.error('[DataSync] Response does not have a json parser function');
              return { error: true };
            }
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
              return await res.json();
            }
            console.error(`[DataSync] Content type is not JSON: ${contentType}`);
            return { error: true };
          } catch (parseError) {
            console.error('[DataSync] Failed to parse JSON response:', parseError);
            return { error: true };
          }
        }));

        if (!isMounted) return;

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
          } else if (me.status === 404 || me.error === 'User not found') {
            // User not found in database, clear session and redirect to login
            console.error('[DataSync] User not found in database, clearing session and redirecting to login');
            document.cookie = 'auth_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            window.location.href = '/login';
          }
        } else if (me && me.status === 401) {
          // Session invalid, redirect to login
          console.error('[DataSync] Session invalid, redirecting to login');
          document.cookie = 'auth_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          window.location.href = '/login';
        }
      } catch (error) {
        console.error('[DataSync] Failed to sync data:', error);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [setClients, setQuotes, setInvoices, setServices, setPayments, setSettings, setCreditNotes, setUser, isAuthenticated]);

  return null;
}
