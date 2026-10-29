'use client';

import * as React from 'react';
import { Label } from '@workspace/ui/components/label';
import { ShieldCheck, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSetupWizard } from '../hooks/useSetupWizard';

interface StepSecurityProps {
  wizard: ReturnType<typeof useSetupWizard>;
}

export function StepSecurity({ wizard }: StepSecurityProps) {
  const { sessionTimeout, setSessionTimeout } = wizard;

  return (
    <div className="space-y-4">
      <div className="p-4 bg-secondary/40 rounded-xl border border-border space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="session-timeout" className="text-xs font-bold">
            Délai de verrouillage automatique
          </Label>
          <span className="text-[11px] font-mono font-bold text-primary">{sessionTimeout} minutes</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {[15, 30, 60, 240].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSessionTimeout(t)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border',
                sessionTimeout === t
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-secondary/60 text-muted-foreground border-border hover:text-foreground'
              )}
            >
              {t === 60 ? '60 min (Recommandé)' : t === 240 ? '4 heures' : `${t} min`}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
          L'application se verrouille automatiquement après ce temps d'inactivité pour sécuriser votre trésorerie en cas d'absence.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Stockage Souverain</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Base SQLite autonome chiffrée sur votre disque dur. Zéro dépendance cloud obligatoire.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <UserCheck className="w-4 h-4 text-primary" />
            <span>Contrôle RBAC</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Rôles stricts Administrateur / Utilisateur pour isoler les accès aux finances.
          </p>
        </div>
      </div>
    </div>
  );
}
