"use client";

import * as React from "react";
import type { Settings } from "@/lib/store";

interface A4FooterProps {
  settings: Settings;
  hash: string;
}

export function A4Footer({ settings: s, hash }: A4FooterProps) {
  return (
    <div className="mt-auto pt-5 pb-1 w-full text-center bg-white text-[8px] text-gray-500 print:break-inside-avoid">
      <div
        className="w-12 h-[2px] mx-auto mb-2"
        style={{ backgroundColor: "var(--color-brand-primary)" }}
      />

      {/* Ligne unique : Identité juridique & fiscale de l'entreprise (sans redondance bancaire ni conditions) */}
      <p className="text-[8px] text-slate-400 text-center leading-tight">
        {[
          s.companyName,
          s.legalForm,
          s.nif ? `NIF : ${s.nif}` : null,
          s.rccm ? `RCCM : ${s.rccm}` : null,
          s.address ? s.address : null,
          s.phone ? `Tél : ${s.phone}` : null,
          s.email ? s.email : null,
        ]
          .filter(Boolean)
          .join(" • ")}
      </p>

      {/* Empreinte de validation fiscale DGI */}
      <p className="text-[7px] font-mono text-slate-300 text-center mt-1 tracking-wider">
        {hash}
      </p>
    </div>
  );
}
