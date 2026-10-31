"use client";

import * as React from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  password?: string;
  isOptional?: boolean;
}

export function PasswordStrengthIndicator({
  password = "",
  isOptional = false,
}: PasswordStrengthIndicatorProps) {
  if (isOptional && !password) {
    return null;
  }

  const hasLength = password.length >= 8;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);

  const passedRules = [hasLength, hasLower && hasUpper, hasDigit].filter(Boolean).length;

  let strengthLabel = "Trop faible";
  let strengthColor = "bg-destructive";
  let textColor = "text-destructive";

  if (passedRules === 2) {
    strengthLabel = "Moyen";
    strengthColor = "bg-amber-500";
    textColor = "text-amber-500";
  } else if (passedRules === 3) {
    strengthLabel = "Robuste";
    strengthColor = "bg-emerald-500";
    textColor = "text-emerald-500";
  }

  if (!password) {
    strengthLabel = "Requis";
    strengthColor = "bg-muted";
    textColor = "text-muted-foreground";
  }

  return (
    <div className="space-y-2.5 pt-1">
      {/* Barre de progression visuelle */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">Robustesse :</span>
          <span className={`font-semibold ${textColor}`}>{strengthLabel}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 h-1.5">
          <div
            className={`rounded-full transition-all duration-300 ${
              passedRules >= 1 ? strengthColor : "bg-muted"
            }`}
          />
          <div
            className={`rounded-full transition-all duration-300 ${
              passedRules >= 2 ? strengthColor : "bg-muted"
            }`}
          />
          <div
            className={`rounded-full transition-all duration-300 ${
              passedRules >= 3 ? strengthColor : "bg-muted"
            }`}
          />
        </div>
      </div>

      {/* Critères explicites en langage clair */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground pt-1">
        <div className="flex items-center gap-1.5">
          {hasLength ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : (
            <X className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          )}
          <span className={hasLength ? "text-foreground font-medium" : ""}>8 caractères min.</span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasLower && hasUpper ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : (
            <X className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          )}
          <span className={hasLower && hasUpper ? "text-foreground font-medium" : ""}>
            Majuscule & minuscule
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasDigit ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : (
            <X className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          )}
          <span className={hasDigit ? "text-foreground font-medium" : ""}>Au moins 1 chiffre</span>
        </div>
      </div>
    </div>
  );
}

