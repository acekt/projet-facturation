'use client';

import * as React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Building2,
  FileText,
  Lock,
} from 'lucide-react';
import { useSetupWizard } from '../hooks/useSetupWizard';

interface SetupLeftPanelProps {
  wizard: ReturnType<typeof useSetupWizard>;
}

export function SetupLeftPanel({ wizard }: SetupLeftPanelProps) {
  const {
    step,
    companyName,
    legalForm,
    nif,
    address,
    logo,
    companyCode,
    computedInvoicePrefix,
    tvaRate,
    cssRate,
    tpsRate,
    bankName,
    identityProgress,
    billingProgress,
    bankProgress,
    companyOverallProgress,
    name,
    email,
  } = wizard;

  const sampleHT = 500000;
  const sampleTVA = Math.round(sampleHT * (tvaRate / 100));
  const sampleCSS = Math.round(sampleHT * (cssRate / 100));
  const sampleTPS = tpsRate > 0 ? Math.round(sampleHT * (tpsRate / 100)) : 0;
  const sampleTTC = sampleHT + sampleTVA + sampleCSS + sampleTPS;

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' XAF';
  };

  return (
    <div className="hidden md:flex flex-col relative w-[44%] lg:w-[40%] xl:w-[38%] h-full bg-gradient-to-br from-primary via-primary/95 to-primary/85 overflow-y-auto p-6 lg:p-7 justify-between select-none border-r border-primary-foreground/10 text-primary-foreground">
      <div className="relative z-10 space-y-4">
        {/* Header Brand */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 bg-white rounded-xl shadow-md overflow-hidden flex items-center justify-center p-1.5 ring-2 ring-white/20">
              <Image src="/logo.png" alt="Logo Facturier" fill className="object-contain p-1" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white block leading-none">Facturier</span>
              <span className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Gestion & Facturation CEMAC</span>
            </div>
          </div>
          <span className="text-[11px] font-bold text-emerald-300 bg-emerald-400/20 border border-emerald-400/30 px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Configuration Rapide
          </span>
        </div>

        {/* Panneau de complétude dynamique */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-300" />
                Dossier Entreprise
              </span>
              <span className="font-mono text-xs font-extrabold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/30">
                {companyOverallProgress}%
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-medium text-white/85">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                    Identité & Siège
                  </span>
                  <span className="font-mono text-[10px] text-white/90">{identityProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${identityProgress}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-medium text-white/85">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                    Régime Fiscal Gabon
                  </span>
                  <span className="font-mono text-[10px] text-emerald-300 font-semibold">{billingProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${billingProgress}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-medium text-white/85">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                    Banque (Optionnel)
                  </span>
                  <span className="font-mono text-[10px] text-white/70">
                    {bankProgress > 0 ? `${bankProgress}%` : 'Non renseigné'}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${bankProgress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-white/75 font-medium">
              <span>
                {companyName.trim() ? "✅ Prêt pour l'accès administrateur" : "⚠️ Saisissez le nom pour avancer"}
              </span>
              <span className="text-emerald-300 font-semibold">
                {companyOverallProgress >= 80 ? 'Niveau Fiduciaire' : 'Niveau Standard'}
              </span>
            </div>
          </motion.div>
        )}

        {/* Aperçu en direct */}
        {step === 1 ? (
          <motion.div
            key="preview-invoice"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between text-[11px] text-white/90 font-bold px-1">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-300" /> Aperçu direct de vos factures
              </span>
              <span className="text-[10px] text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/30 font-mono">
                Conforme DGI Gabon
              </span>
            </div>

            <div className="bg-white text-slate-900 rounded-2xl p-4 shadow-xl border border-white/40 space-y-2.5 relative overflow-hidden">
              <div className="flex items-start justify-between border-b border-slate-100 pb-2.5 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center font-bold text-primary text-sm shrink-0 overflow-hidden shadow-xs">
                    {logo ? (
                      <img src={logo} alt="Logo Entreprise" className="w-full h-full object-contain p-1" />
                    ) : (
                      <span className="font-extrabold tracking-wider text-primary text-base">
                        {(companyCode || (companyName || 'FAC').slice(0, 2)).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900 leading-tight truncate max-w-[170px]">
                      {companyName.trim() || 'Votre Entreprise'}
                    </div>
                    <div className="text-[10px] font-bold text-primary flex items-center gap-1.5 mt-0.5">
                      <span className="bg-primary/10 px-1.5 py-0.2 rounded font-mono text-[9px]">{legalForm}</span>
                      {nif.trim() && (
                        <>
                          <span>•</span>
                          <span className="text-slate-500 font-mono font-normal truncate max-w-[100px]">
                            NIF: {nif.trim()}
                          </span>
                        </>
                      )}
                    </div>
                    {address.trim() && (
                      <div className="text-[9px] text-slate-400 font-medium truncate max-w-[170px] mt-0.5">
                        📍 {address.trim()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[8px] uppercase tracking-wider font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Original
                  </span>
                  <div className="text-xs font-mono font-bold text-slate-900 mt-1">
                    {computedInvoicePrefix}2026-0001
                  </div>
                  <div className="text-[9px] text-slate-400">Date: 26/10/2026</div>
                </div>
              </div>

              <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 space-y-1 relative z-10 text-[10px]">
                <div className="flex justify-between font-bold text-slate-700 border-b border-slate-200/60 pb-1">
                  <span>Prestation / Article d'exemple</span>
                  <span className="font-mono">{formatMoney(sampleHT)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[9px]">
                  <span>TVA légale ({tvaRate}%)</span>
                  <span className="font-mono">{formatMoney(sampleTVA)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[9px]">
                  <span>CSS Solidarité ({cssRate}%)</span>
                  <span className="font-mono">{formatMoney(sampleCSS)}</span>
                </div>
                {tpsRate > 0 && (
                  <div className="flex justify-between text-slate-500 text-[9px]">
                    <span>TPS Prestations ({tpsRate}%)</span>
                    <span className="font-mono">{formatMoney(sampleTPS)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-slate-900 pt-1 border-t border-slate-200/60 text-[11px]">
                  <span className="text-primary font-bold">Total Net à Payer</span>
                  <span className="font-mono text-emerald-600">{formatMoney(sampleTTC)}</span>
                </div>
              </div>

              <div className="text-[9px] text-slate-500 flex items-center justify-between pt-0.5 relative z-10 border-t border-slate-100">
                <span className="truncate max-w-[200px]">
                  {bankName.trim() ? `Paiement : ${bankName}` : 'Paiement à réception'}
                </span>
                <span className="font-mono text-[8px] text-slate-400">Page 1/1</span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview-admin"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between text-[11px] text-white/90 font-bold px-1">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" /> Badge d'Accès Maître
              </span>
              <span className="text-[10px] text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/30">
                Actif
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-900 font-extrabold flex items-center justify-center text-base shadow-md">
                  {name.trim()
                    ? name.trim().split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                    : 'AD'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white truncate">
                    {name.trim() || 'Votre Nom & Prénom'}
                  </div>
                  <div className="text-xs text-white/70 truncate">
                    {email.trim() || 'admin@votre-entreprise.ga'}
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-300 mt-0.5 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Gérant / Super-Administrateur
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 text-[11px] text-white/80 space-y-1">
                <div className="flex justify-between">
                  <span className="text-white/60">Entreprise affiliée :</span>
                  <span className="font-bold text-white truncate max-w-[150px]">{companyName || 'Facturier'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Rôle système :</span>
                  <span className="font-mono text-emerald-300 font-semibold">Propriétaire (Local)</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className="pt-3 border-t border-white/15 relative z-10 space-y-1">
        <div className="flex items-center gap-2 text-xs text-white/90 font-semibold">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-300" />
          <span>Architecture Local-First & Données Chiffrées</span>
        </div>
        <p className="text-[11px] text-white/70 leading-relaxed font-normal">
          Vos données de facturation sont stockées localement en SQLite sans dépendance d'accès Internet permanent.
        </p>
      </div>
    </div>
  );
}
