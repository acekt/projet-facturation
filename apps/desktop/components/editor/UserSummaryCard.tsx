"use client";

import * as React from "react";
import { User, Mail, ShieldCheck, CheckCircle2, XCircle, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { getInitials } from "@/lib/utils";

interface UserSummaryCardProps {
  name: string;
  email: string;
  role: "admin" | "user";
  isActive: boolean;
  isSubmitting: boolean;
  isEditing: boolean;
}

export function UserSummaryCard({
  name,
  email,
  role,
  isActive,
  isSubmitting,
  isEditing,
}: UserSummaryCardProps) {
  return (
    <Card className="bg-card border-border sticky top-6 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
        <CardTitle className="text-foreground font-semibold text-base">Fiche Utilisateur</CardTitle>
        <CardDescription className="text-xs">
          Aperçu temps réel du profil avant enregistrement
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* AVATAR + NOM */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
          <Avatar className="w-11 h-11 ring-2 ring-primary/20">
            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
              {getInitials(name || "Utilisateur")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">
              {name || "Nom non défini"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {email || "email@domaine.ga"}
            </p>
          </div>
        </div>

        {/* DÉTAILS DU COMPTE */}
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/70">
            <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              Rôle
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                role === "admin"
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {role === "admin" ? "Administrateur" : "Opérateur"}
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/70">
            <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
              {isActive ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-destructive" />
              )}
              Statut du compte
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-destructive/10 text-destructive border border-destructive/20"
              }`}
            >
              {isActive ? "Actif (Autorisé)" : "Désactivé"}
            </span>
          </div>
        </div>

        {/* BOUTON D'ACTION PRINCIPAL */}
        <div className="pt-2">
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 font-medium cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            disabled={isSubmitting}
          >
            <Save className="w-4 h-4" />
            {isSubmitting
              ? "Enregistrement..."
              : isEditing
              ? "Mettre à jour (Ctrl+S)"
              : "Créer le compte (Ctrl+S)"}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground mt-2">
            Raccourci clavier : Touche <kbd className="font-mono bg-muted px-1 rounded">Ctrl</kbd> + <kbd className="font-mono bg-muted px-1 rounded">S</kbd>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
