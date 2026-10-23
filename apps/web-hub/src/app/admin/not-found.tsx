import Link from "next/link";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export default function AdminNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-xl text-center space-y-5">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto shadow-inner">
          <FileQuestion className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            Ressource Introuvable (404)
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            L'identifiant du tenant, le terminal ou la section administrative demandée n'existe pas ou a été déplacé.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            asChild
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground shadow-xs cursor-pointer"
          >
            <Link href="/admin">
              <Home className="h-3.5 w-3.5" />
              Centre de Contrôle
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border-border bg-secondary/50 hover:bg-secondary text-foreground cursor-pointer"
          >
            <Link href="/admin/tenants">
              <ArrowLeft className="h-3.5 w-3.5" />
              Annuaire des Tenants
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

