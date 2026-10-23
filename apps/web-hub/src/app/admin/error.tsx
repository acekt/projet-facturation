"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon, RotateCcw, Home, ShieldAlert } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Journalisation locale de l'erreur pour investigation
    console.error("[admin-error-boundary]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-card border border-destructive/20 shadow-xl text-center space-y-5">
        <div className="h-14 w-14 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center mx-auto shadow-inner">
          <AlertOctagon className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-foreground tracking-tight">
            Interruption Inattendue du Service
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Une erreur s'est produite lors de la communication avec la base de données centrale ou le rendu du composant.
          </p>
        </div>

        {error.digest && (
          <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-[11px] font-mono text-muted-foreground">
            Identifiant incident : <span className="text-primary font-semibold">{error.digest}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground shadow-xs cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Réessayer
          </Button>

          <Button
            asChild
            variant="outline"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border-border bg-secondary/50 hover:bg-secondary text-foreground cursor-pointer"
          >
            <Link href="/admin">
              <Home className="h-3.5 w-3.5" />
              Centre de Contrôle
            </Link>
          </Button>
        </div>

        <div className="pt-3 border-t border-border flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
          <ShieldAlert className="h-3 w-3 text-primary" />
          <span>Hub Facturier • Protection d'intégrité active</span>
        </div>
      </div>
    </div>
  );
}

