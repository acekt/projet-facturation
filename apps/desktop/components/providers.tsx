"use client"

import * as React from "react"
import { ThemeProvider } from "next-themes"
import { ErrorBoundary } from "react-error-boundary"
import { AlertTriangle } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Toaster } from "sonner"
import { CloudSyncRunner } from "@/components/cloud-sync-runner"

function FallbackError({ error, resetErrorBoundary }: { error: any; resetErrorBoundary: (...args: any[]) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
      <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Une erreur inattendue est survenue</h1>
      <p className="text-slate-500 mb-6 max-w-md">
        Le composant applicatif a rencontré un problème. Veuillez rafraîchir la page ou retourner à l'accueil.
      </p>
      <div className="bg-slate-100 p-4 rounded-md mb-6 w-full max-w-lg text-left overflow-auto text-sm text-slate-800">
        <code>{error.message}</code>
      </div>
      <Button onClick={resetErrorBoundary}>Réessayer</Button>
    </div>
  )
}

let hasReportedReady = false;

export function Providers({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    if (!hasReportedReady && typeof window !== "undefined" && window.electron?.reportAppReady) {
      hasReportedReady = true;
      window.electron.reportAppReady().catch(() => {});
    }
  }, []);

  // Safety net anti-blocage Radix UI (gel de document.body.style.pointerEvents = 'none')
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // Interception des rejets non gérés de type Event (ex: échec de chargement d'image ou média)
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (
        reason instanceof Event ||
        (reason && typeof reason === "object" && ("target" in reason || "type" in reason))
      ) {
        event.preventDefault();
        console.warn("[Global Safety] Intercepted unhandled DOM Event rejection:", reason?.type || reason);
      }
    };
    window.addEventListener("unhandledrejection", handleRejection);

    if (!window.MutationObserver) return () => window.removeEventListener("unhandledrejection", handleRejection);
    const cleanup = () => {
      const anyActiveOverlay = document.querySelector(
        '[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"], [data-radix-portal] [data-state="open"]'
      );
      if (!anyActiveOverlay && document.body.style.pointerEvents === "none") {
        document.body.style.pointerEvents = "";
      }
    };
    const observer = new MutationObserver(cleanup);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      observer.disconnect();
    };
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
    >
      <ErrorBoundary FallbackComponent={FallbackError}>
        <CloudSyncRunner />
        {children}
      </ErrorBoundary>
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  )
}
