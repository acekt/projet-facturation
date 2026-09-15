"use client"

import * as React from "react"
import { ThemeProvider } from "next-themes"
import { ErrorBoundary } from "react-error-boundary"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

import { Toaster } from "sonner"

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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
    >
      <ErrorBoundary FallbackComponent={FallbackError}>
        {children}
      </ErrorBoundary>
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  )
}
