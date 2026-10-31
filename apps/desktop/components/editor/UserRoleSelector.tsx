"use client";

import * as React from "react";
import { ShieldCheck, UserCheck, CheckCircle2 } from "lucide-react";
import { Label } from "@workspace/ui/components/label";

interface UserRoleSelectorProps {
  value: "admin" | "user";
  onChange: (value: "admin" | "user") => void;
  disabled?: boolean;
  disabledMessage?: string;
  error?: string;
}

export function UserRoleSelector({
  value,
  onChange,
  disabled = false,
  disabledMessage,
  error,
}: UserRoleSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-foreground font-semibold text-xs uppercase tracking-wider">
          Rôle & Droits d&apos;accès <span className="text-destructive">*</span>
        </Label>
        {disabled && disabledMessage && (
          <span className="text-[11px] text-muted-foreground italic">{disabledMessage}</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* CARTE OPÉRATEUR */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("user")}
          className={`relative p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            value === "user"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
              : "border-border bg-card/50 hover:bg-muted/40 hover:border-border/80"
          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    value === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Opérateur</h4>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Gestion commerciale
                  </span>
                </div>
              </div>
              {value === "user" && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed pt-1">
              Création et suivi des devis, factures, encaissements et gestion du portefeuille clients.
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-wrap gap-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
              Devis & Factures
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
              Avoirs & Règl.
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
              Clients
            </span>
          </div>
        </button>

        {/* CARTE ADMINISTRATEUR */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("admin")}
          className={`relative p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            value === "admin"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
              : "border-border bg-card/50 hover:bg-muted/40 hover:border-border/80"
          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    value === "admin"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Administrateur</h4>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Gouvernance totale
                  </span>
                </div>
              </div>
              {value === "admin" && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed pt-1">
              Supervision complète, gestion des utilisateurs, journal d&apos;audit et configuration fiscale.
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-wrap gap-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              Contrôle Total
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
              Paramètres fiscaux
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
              Journal d&apos;audit
            </span>
          </div>
        </button>
      </div>

      {error && <p className="text-destructive text-sm font-medium">{error}</p>}
    </div>
  );
}

