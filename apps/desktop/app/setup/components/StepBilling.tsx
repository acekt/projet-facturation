'use client';

import * as React from 'react';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Textarea } from '@workspace/ui/components/textarea';
import { CheckCircle2 } from 'lucide-react';
import { useSetupWizard } from '../hooks/useSetupWizard';

interface StepBillingProps {
  wizard: ReturnType<typeof useSetupWizard>;
}

export function StepBilling({ wizard }: StepBillingProps) {
  const {
    companyCode,
    setCompanyCode,
    setIsCodeCustom,
    cleanCompanyCode,
    computedInvoicePrefix,
    computedQuotePrefix,
    tvaRate,
    setTvaRate,
    cssRate,
    setCssRate,
    tpsRate,
    setTpsRate,
    mentionsLegales,
    setMentionsLegales,
  } = wizard;

  return (
    <div className="space-y-4">
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-start gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <span className="text-xs text-foreground/85 leading-relaxed">
          Ces valeurs sont <strong>préréglées et conformes</strong> à la fiscalité CEMAC / DGI Gabon (TVA à 18%, CSS à 1% et TPS à 9.5%). Vous pouvez les adapter à vos régimes spécifiques.
        </span>
      </div>

      {/* Numérotation */}
      <div className="p-4 bg-secondary/40 rounded-xl border border-border space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="company-code" className="text-xs font-bold flex items-center gap-1.5 text-foreground">
            <span>Code Sigle de l'entreprise</span>
            <span className="text-destructive">*</span>
            <span className="text-[10px] text-muted-foreground font-normal">(Initiales intégrées aux pièces)</span>
          </Label>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            Modifiable & Visible
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div className="space-y-1 sm:col-span-1">
            <Input
              id="company-code"
              type="text"
              value={companyCode}
              onChange={(e) => {
                setIsCodeCustom(true);
                setCompanyCode(e.target.value.toUpperCase());
              }}
              placeholder="ex: GM"
              className="bg-card border-border font-mono uppercase font-bold text-sm tracking-wider text-primary text-center h-10"
              maxLength={6}
              required
            />
            <span className="text-[10px] text-muted-foreground block text-center">
              ex: GM pour Global Maintenance
            </span>
          </div>

          <div className="sm:col-span-2 grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-card/80 border border-border/70 space-y-1 shadow-2xs">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold text-foreground">Factures</span>
                <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-500/10 px-1 rounded">FAC Auto</span>
              </div>
              <div className="text-xs font-mono font-bold text-primary truncate">
                {computedInvoicePrefix}2026-0001
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-card/80 border border-border/70 space-y-1 shadow-2xs">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold text-foreground">Devis</span>
                <span className="text-[9px] font-semibold text-teal-600 dark:text-teal-400 font-mono bg-teal-500/10 px-1 rounded">DEV Auto</span>
              </div>
              <div className="text-xs font-mono font-bold text-teal-700 dark:text-teal-300 truncate">
                {computedQuotePrefix}2026-0001
              </div>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground leading-normal">
          ℹ️ Les préfixes <strong className="text-foreground">FAC</strong> et <strong className="text-foreground">DEV</strong> sont attribués automatiquement par le système selon la nature du document. Seul votre code d'entreprise (<span className="font-mono font-bold text-primary">{cleanCompanyCode}</span>) y est adjoint.
        </p>
      </div>

      {/* Taux légaux */}
      <div className="p-3.5 bg-secondary/40 rounded-xl border border-border space-y-2.5">
        <span className="text-xs font-bold text-foreground block">Taux légaux applicables</span>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] font-medium">TVA (%)</Label>
            <Input
              type="number"
              step="0.1"
              value={tvaRate}
              onChange={(e) => setTvaRate(parseFloat(e.target.value) || 0)}
              className="bg-card border-border text-xs font-mono"
            />
            <span className="text-[10px] text-muted-foreground">Standard 18%</span>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-medium">CSS (%)</Label>
            <Input
              type="number"
              step="0.1"
              value={cssRate}
              onChange={(e) => setCssRate(parseFloat(e.target.value) || 0)}
              className="bg-card border-border text-xs font-mono"
            />
            <span className="text-[10px] text-muted-foreground">Solidarité 1%</span>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-medium">TPS (%)</Label>
            <Input
              type="number"
              step="0.1"
              value={tpsRate}
              onChange={(e) => setTpsRate(parseFloat(e.target.value) || 0)}
              className="bg-card border-border text-xs font-mono"
            />
            <span className="text-[10px] text-muted-foreground">Prestations 9.5%</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mentions-legales" className="text-xs font-medium">Mentions Légales en pied de page</Label>
        <Textarea
          id="mentions-legales"
          value={mentionsLegales}
          onChange={(e) => setMentionsLegales(e.target.value)}
          placeholder="Ex: Facture payable à réception. En cas de retard de paiement, une indemnité légale sera appliquée..."
          className="bg-secondary/50 border-border min-h-[65px] text-xs"
        />
      </div>
    </div>
  );
}
