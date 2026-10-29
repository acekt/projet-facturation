'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@workspace/ui/components/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs';
import {
  Building2,
  Percent,
  Landmark,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSetupWizard } from '../hooks/useSetupWizard';
import { StepIdentity } from './StepIdentity';
import { StepBilling } from './StepBilling';
import { StepBank } from './StepBank';
import { StepSecurity } from './StepSecurity';

interface StepCompanyProps {
  wizard: ReturnType<typeof useSetupWizard>;
}

export function StepCompany({ wizard }: StepCompanyProps) {
  const {
    companyTab,
    setCompanyTab,
    identityProgress,
    bankProgress,
    handleNextStep,
  } = wizard;

  return (
    <motion.form
      key="step-1"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.2 }}
      onSubmit={handleNextStep}
      className="space-y-6"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Profil de votre Entreprise
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Renseignez le nom de votre structure. Tout est modifiable plus tard dans les Paramètres.
            </p>
          </div>
        </div>
      </div>

      <Tabs value={companyTab} onValueChange={(v) => setCompanyTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-4 bg-secondary/80 p-1 rounded-xl mb-4 text-xs font-semibold">
          <TabsTrigger value="identity" className="rounded-lg gap-1.5 text-xs relative cursor-pointer">
            <Building2 className="w-3.5 h-3.5" />
            <span>Identité</span>
            <span
              className={cn(
                'w-2 h-2 rounded-full shrink-0 transition-colors',
                identityProgress >= 60 ? 'bg-emerald-500' : 'bg-amber-500'
              )}
            />
          </TabsTrigger>

          <TabsTrigger value="billing" className="rounded-lg gap-1.5 text-xs relative cursor-pointer">
            <Percent className="w-3.5 h-3.5" />
            <span>Facturation</span>
            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              100%
            </span>
          </TabsTrigger>

          <TabsTrigger value="bank" className="rounded-lg gap-1.5 text-xs relative cursor-pointer">
            <Landmark className="w-3.5 h-3.5" />
            <span>Banque</span>
            <span className="text-[9px] font-normal text-muted-foreground">
              {bankProgress > 0 ? 'Prêt' : 'Opt.'}
            </span>
          </TabsTrigger>

          <TabsTrigger value="security" className="rounded-lg gap-1.5 text-xs relative cursor-pointer">
            <Shield className="w-3.5 h-3.5" />
            <span>Sécurité</span>
            <span className="text-[9px] font-normal text-muted-foreground">Auto</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="mt-0">
          <StepIdentity wizard={wizard} />
        </TabsContent>

        <TabsContent value="billing" className="mt-0">
          <StepBilling wizard={wizard} />
        </TabsContent>

        <TabsContent value="bank" className="mt-0">
          <StepBank wizard={wizard} />
        </TabsContent>

        <TabsContent value="security" className="mt-0">
          <StepSecurity wizard={wizard} />
        </TabsContent>
      </Tabs>

      <div className="pt-2">
        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-sm h-12 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <span>Continuer vers l'accès administrateur</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <p className="text-center text-[11px] text-muted-foreground mt-2 font-medium">
          Étape 1/2 • Vos données restent enregistrées localement sur votre ordinateur
        </p>
      </div>
    </motion.form>
  );
}
