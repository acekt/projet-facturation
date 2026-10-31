"use client";

import * as React from "react";
import type { Settings } from "@/lib/store";
import type { DocumentType } from "./A4Header";
import { amountInWordsFCFA } from "@/lib/utils/amount-in-words";

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
  notes?: string | null;
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
  notes,
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

        {/* Conditions & Modalités de règlement */}
        <div className="text-[8.5px] text-slate-500 flex flex-col gap-0.5">
          {notes && notes.trim() !== "" ? (
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <p className="font-semibold text-slate-700 uppercase text-[7.5px] tracking-wider mb-0.5">
                {type === "avoir" ? "Modalités de remboursement" : "Conditions & Notes"}
              </p>
              <p className="text-[8px] text-slate-600 whitespace-pre-line leading-relaxed">
                {notes.trim()}
              </p>
            </div>
          ) : type === "avoir" ? (
            <p>
              <span className="font-semibold text-slate-700">Modalité :</span> Crédit porté en déduction des prochaines factures ou remboursement selon accord commercial
            </p>
          ) : type === "devis" ? (
            <p>
              <span className="font-semibold text-slate-700">Règlement :</span> Virement bancaire ou chèque à validation du bon de commande
            </p>
          ) : (
            <>
              <p>
                <span className="font-semibold text-slate-700">Règlement :</span> Espèces · Chèques · Virements
              </p>
              <p>
                <span className="font-semibold text-slate-700">Délais :</span> Au comptant
              </p>
            </>
          )}
        </div>

        {/* Arrêté légal du montant en toutes lettres */}
        <div className="p-2.5 rounded bg-slate-50 border-l-2 border-brand-primary text-[8px] text-slate-700 leading-relaxed">
          <span className="font-bold">
            Arrêté{" "}
            {type === "devis"
              ? "le présent devis à la somme estimative de"
              : type === "avoir"
              ? "la présente note d'avoir à la somme de"
              : "la présente facture à la somme de"}{" "}
            :
          </span>{" "}
          <span className="font-semibold">{amountInWordsFCFA(total)}</span> ({fmt(total)}).
        </div>

        {/* Signature */}
        <div className="mt-2">
          <p className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">
            La Direction
          </p>
          <div className="border-b border-slate-300 w-32 mt-8 mb-1" />
          <p className="text-[8px] text-slate-400 font-medium">Cachet & Signature autorisée</p>
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

          {/* LOGIQUE CONDITIONNELLE (DEVIS vs AVOIR vs FACTURE) */}
          {type === "devis" ? (
            <div className="mt-2 bg-slate-50 p-3 rounded-lg flex justify-between items-center print:break-inside-avoid">
              <span className="text-[12px] font-extrabold text-slate-800 uppercase tracking-widest">
                Total Estimé TTC
              </span>
              <span className="text-[14px] font-extrabold text-slate-800 tabular-nums leading-none">
                {fmt(total)}
              </span>
            </div>
          ) : type === "avoir" ? (
            <div className="mt-2 bg-orange-50 border border-orange-200/60 p-3 rounded-lg flex justify-between items-center print:break-inside-avoid">
              <span className="text-[11px] font-extrabold text-orange-800 uppercase tracking-widest">
                Montant Avoir TTC (Crédit)
              </span>
              <span className="text-[14px] font-extrabold text-orange-900 tabular-nums leading-none">
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

