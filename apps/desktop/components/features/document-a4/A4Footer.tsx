"use client";

import * as React from "react";
import type { Settings } from "@/lib/store";

interface A4FooterProps {
  settings: Settings;
  hash: string;
}

export function A4Footer({ settings: s, hash }: A4FooterProps) {
  return (
    <div className="fixed bottom-0 left-0 w-full px-[15mm] pb-[15mm] text-center bg-white text-[8px] text-gray-500">
      <div
        className="w-12 h-[2px] mx-auto mb-2"
        style={{ backgroundColor: "var(--color-brand-primary)" }}
      />

      {/* Ligne 1 : Identité complète de l'entreprise */}
      <p className="text-[8px] text-slate-400 text-center leading-tight">
        {[
          s.companyName,
          s.legalForm,
          s.nif ? `NIF : ${s.nif}` : null,
          s.rccm ? `RCCM : ${s.rccm}` : null,
          s.phone ? `Tél : ${s.phone}` : null,
          s.email ? s.email : null,
        ]
          .filter(Boolean)
          .join(" | ")}
      </p>

      {/* Ligne 2 : Coordonnées bancaires */}
      {(s.bankName || s.accountNumber) && (
        <p className="text-[8px] text-slate-400 text-center leading-tight mt-0.5">
          {[
            s.bankName && `Banque : ${s.bankName}`,
            s.accountNumber && `N° Compte : ${s.accountNumber}`,
            s.iban && `IBAN : ${s.iban}`,
          ]
            .filter(Boolean)
            .join(" | ")}
        </p>
      )}

      {/* Ligne 3 : Mention légale libre */}
      {s.mentionsLegales && (
        <p className="text-[7.5px] text-slate-400 italic text-center leading-tight mt-0.5">
          {s.mentionsLegales}
        </p>
      )}

      {/* Ligne 4 : Référence de validation fiscale DGI */}
      <p className="text-[7px] font-mono text-slate-300 text-center mt-1 tracking-wider">
        {hash}
      </p>
    </div>
  );
}

