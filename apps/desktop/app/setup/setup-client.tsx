'use client';

import * as React from 'react';
import { AnimatePresence } from 'framer-motion';
import { Building2, UserCheck, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSetupWizard } from './hooks/useSetupWizard';
import { SetupLeftPanel } from './components/SetupLeftPanel';
import { StepCompany } from './components/StepCompany';
import { StepAdmin } from './components/StepAdmin';

export default function SetupClient() {
  const wizard = useSetupWizard();
  const { step, setStep, companyName, globalProgress } = wizard;

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-background text-foreground transition-colors duration-300">
      <div className="w-full h-full flex flex-col md:flex-row">
        {/* Colonne Gauche : Dotation, Progression & Confiance */}
        <SetupLeftPanel wizard={wizard} />

        {/* Colonne Droite : Formulaire d'onboarding dynamique */}
        <div className="flex-1 h-full overflow-y-auto p-5 sm:p-7 lg:p-10 flex flex-col justify-between">
          <div className="max-w-xl mx-auto w-full space-y-6">
            {/* Header d'étapes ergonomique */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-extrabold">
                    {step}
                  </span>
                  <span className="text-foreground uppercase tracking-wider text-[11px]">
                    {step === 1 ? 'Étape 1 : Votre Entreprise' : 'Étape 2 : Administrateur'}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-primary">{globalProgress}% complété</span>
              </div>

              {/* Barre de progression globale */}
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${globalProgress}%` }}
                />
              </div>

              {/* Indicateurs de jalons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-xl text-left border transition-all cursor-pointer',
                    step === 1
                      ? 'border-primary bg-primary/5 shadow-xs'
                      : 'border-border/60 bg-secondary/30 hover:bg-secondary/60 opacity-80'
                  )}
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs',
                      step === 1 ? 'bg-primary text-primary-foreground' : 'bg-emerald-500/20 text-emerald-600'
                    )}
                  >
                    {step === 2 ? <CheckCircle2 className="w-4 h-4" /> : <Building2 className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold block truncate text-foreground leading-tight">
                      1. Entreprise
                    </span>
                    <span className="text-[9px] text-muted-foreground truncate block">
                      {companyName.trim() || 'Identité & Taux'}
                    </span>
                  </div>
                </button>

                <div
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-xl text-left border transition-all',
                    step === 2
                      ? 'border-primary bg-primary/5 shadow-xs'
                      : 'border-border/60 bg-secondary/30 opacity-60'
                  )}
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs',
                      step === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold block truncate text-foreground leading-tight">
                      2. Accès Maître
                    </span>
                    <span className="text-[9px] text-muted-foreground truncate block">Compte Administrateur</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Formulaires d'étapes avec animation */}
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <StepCompany key="step-1" wizard={wizard} />
              ) : (
                <StepAdmin key="step-2" wizard={wizard} />
              )}
            </AnimatePresence>
          </div>

          <div className="text-center pt-6 text-[10px] text-muted-foreground font-medium max-w-xl mx-auto w-full border-t border-border/40 mt-6">
            Facturier v1.0 • Conforme aux dispositions de la Direction Générale des Impôts (DGI) du Gabon
          </div>
        </div>
      </div>
    </div>
  );
}
