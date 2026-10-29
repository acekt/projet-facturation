"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

interface QuoteEditorHeaderProps {
  editingId?: string | null;
  status: string;
  onBackSafe: () => void;
}

export function QuoteEditorHeader({ editingId, status, onBackSafe }: QuoteEditorHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBackSafe} className="cursor-pointer">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {editingId ? "Modifier le Devis" : "Nouveau Devis"}
          </h1>
          <p className="text-muted-foreground mt-1">Créez une proposition commerciale professionnelle conforme OHADA</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {status === "CONVERTI" && (
          <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm font-semibold">
            Devis Converti (Lecture seule)
          </div>
        )}
      </div>
    </div>
  );
}

