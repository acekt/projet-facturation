"use client";

import * as React from "react";
import type { Settings } from "@/lib/store";
import type { DocumentType } from "./A4Header";

interface A4FiscalSummaryProps {
  settings: Settings;
  type: DocumentType;
  subtotal: number;
  discount: number;
  netHT: number;
  cssAmount: number;
  tpsAmount: number;
  tvaAmount: number;
  total: number;
  totalPaid: number;
  remaining: number;
  formatCurrency: (n: number) => string;
}

export function A4FiscalSummary({
  settings: s,
  type,
  subtotal,
  discount,
  netHT,
  cssAmount,
  tpsAmount,
  tvaAmount,
  total,
  totalPaid,
  remaining,
  formatCurrency: fmt,
}: A4FiscalSummaryProps) {
  return (
    <div className="grid grid-cols-2 mt-auto pt-6 gap-8">
      {/* ─ COLONNE GAUCHE : BANQUE & SIGNATURE ─ */}
      <div className="flex flex-col gap-4">
        {/* Encadré Bancaire */}
        <div className="border border-slate-200 rounded px-3 py-2.5 bg-slate-50">
          <p className="text-[8px] font-bold uppercase tracking-widest text-brand-primary mb-2">
            Coordonnées pour Virement Bancaire
          </p>
          <div className="text-[8.5px] text-slate-600 space-y-0.5">
            {s.bankName && (
              <p>
                <span className="font-semibold text-slate-700">Banque :</span> {s.bankName}
              </p>
            )}
            {s.bankAgency && (
              <p>
                <span className="font-semibold text-slate-700">Agence :</span> {s.bankAgency}
              </p>
            )}
            {s.accountNumber && (
              <p>
                <span className="font-semibold text-slate-700">N° Compte :</span> {s.accountNumber}
              </p>
            )}
            {s.swiftCode && (
              <p>
                <span className="font-semibold text-slate-700">SWIFT/BIC :</span> {s.swiftCode}
              </p>
            )}
            {s.iban && (
              <p>
                <span className="font-semibold text-slate-700">IBAN/RIB :</span>{" "}
                <span className="font-mono text-[8px]">{s.iban}</span>
              </p>
            )}
          </div>
        </div>

        {/* Conditions de règlement */}
        <div className="text-[8.5px] text-slate-500 flex flex-col gap-0.5">
          <p>
            <span className="font-semibold text-slate-700">Règlement :</span> Espèces · Chèques · Virements
          </p>
          <p>
            <span className="font-semibold text-slate-700">Délais :</span> Au comptant
          </p>
        </div>

        {/* Signature */}
        <div className="mt-4">
          <p className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">
            La Direction
          </p>
          <div className="border-b border-slate-300 w-32 mt-10 mb-1" />
          <p className="text-[8px] text-slate-400 font-medium">Cachet & Signature</p>
        </div>
      </div>

      {/* ─ COLONNE DROITE : TOTAUX DYNAMIQUES ─ */}
      <div className="flex flex-col items-end">
        <div className="w-[240px]">
          {/* Lignes standards */}
          <div className="text-[9px] mb-2 space-y-1">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Brut HT</span>
              <span className="font-semibold text-slate-800 tabular-nums">
                {fmt(subtotal)}
              </span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Remise</span>
                <span className="font-semibold text-slate-600 tabular-nums">
                  − {fmt(discount)}
                </span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Net HT</span>
              <span className="font-semibold text-slate-800 tabular-nums">
                {fmt(netHT)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">
                CSS ({s.cssRate ?? 1}%)
              </span>
              <span className="font-semibold text-slate-800 tabular-nums">
                {fmt(cssAmount)}
              </span>
            </div>
            {tpsAmount > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">
                  TPS ({s.tpsRate ?? 9.5}%)
                </span>
                <span className="font-semibold text-slate-800 tabular-nums">
                  {fmt(tpsAmount)}
                </span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">
                TVA ({s.tvaRate ?? 18}%)
              </span>
              <span className="font-semibold text-slate-800 tabular-nums">
                {fmt(tvaAmount)}
              </span>
            </div>
          </div>

          {/* LOGIQUE CONDITIONNELLE (DEVIS vs FACTURE/AVOIR) */}
          {type === "devis" ? (
            <div className="mt-2 bg-slate-50 p-3 rounded-lg flex justify-between items-center print:break-inside-avoid">
              <span className="text-[14px] font-extrabold text-slate-800 uppercase tracking-widest">
                Net à Payer
              </span>
              <span className="text-[14px] font-extrabold text-slate-800 tabular-nums leading-none">
                {fmt(total)}
              </span>
            </div>
          ) : (
            <div className="mt-2">
              <div className="bg-brand-primary rounded px-3 py-2.5 flex justify-between items-center net-box">
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                  Total TTC
                </span>
                <span className="text-[14px] font-extrabold text-white tabular-nums leading-none">
                  {fmt(total)}
                </span>
              </div>

              {/* Lignes de paiements (Réglé & Reste) */}
              <div className="mt-2 text-[9px] flex flex-col gap-1.5 px-1 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Réglé</span>
                  <span className="text-slate-600 font-semibold tabular-nums">
                    {fmt(totalPaid)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-brand-primary">Reste à Payer</span>
                  <span className="font-bold text-[var(--color-brand-accent)] tabular-nums text-[11px]">{fmt(remaining)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

