"use client";

import * as React from "react";
import type { Settings } from "@/lib/store";

export type DocumentType = "facture" | "devis" | "avoir";

interface A4HeaderProps {
  settings: Settings;
  type: DocumentType;
  docNumber: string;
  docDate: string;
  validUntil?: string | null;
  dueDate?: string | null;
  relatedInvoiceNumber?: string | null;
}

function fmtDate(s: string): string {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) {
    const [year, month, day] = s.trim().split('-');
    return `${day}/${month}/${year}`;
  }
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(s));
  } catch {
    return s;
  }
}

function labelOf(type: DocumentType) {
  return type === "facture" ? "FACTURE" : type === "devis" ? "DEVIS" : "NOTE D'AVOIR";
}

export function A4Header({
  settings: s,
  type,
  docNumber,
  docDate,
  validUntil,
  dueDate,
  relatedInvoiceNumber,
}: A4HeaderProps) {
  return (
    <>
      <div className="flex justify-between items-start mb-4">
        {/* LEFT — Logo + Bloc entreprise */}
        <div className="flex items-start gap-3">
          {s.logo ? (
            <img
              src={s.logo}
              alt="Logo"
              className="h-14 w-auto object-contain flex-shrink-0"
            />
          ) : (
            <div className="h-14 w-14 rounded-sm bg-brand-primary flex items-center justify-center text-white text-[7px] font-bold tracking-widest flex-shrink-0">
              LOGO
            </div>
          )}
          <div className="flex flex-col justify-center">
            <p className="text-[14px] font-extrabold text-brand-primary uppercase leading-tight tracking-wide">
              {s.companyName || "NOM ENTREPRISE"}
            </p>
            {s.legalForm && (
              <p className="text-[8px] text-slate-400 font-medium tracking-wider mt-0.5">
                {s.legalForm}
              </p>
            )}
            {s.address && (
              <p className="text-[8px] text-slate-500 mt-0.5">{s.address}</p>
            )}
            {(s.phone || s.email) && (
              <p className="text-[8px] text-slate-500 mt-0.5">
                {[s.phone && `Tél : ${s.phone}`, s.email]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT — Type de document + N° complet + Dates */}
        <div className="text-right flex flex-col items-end gap-0.5">
          <p className="text-3xl font-black text-slate-800 tracking-tight leading-none uppercase">
            {labelOf(type)}
          </p>
          <p className="text-[9px] font-bold text-slate-700 mt-1 tracking-wide">
            N° {docNumber}
          </p>
          <div className="w-full h-px bg-slate-200 my-1" />
          <p className="text-[8px] text-slate-500">
            Date d&apos;émission :{" "}
            <span className="font-semibold text-slate-700">
              {fmtDate(docDate)}
            </span>
          </p>
          {type === "devis" && validUntil && (
            <p className="text-[8px] text-slate-500 mt-0.5">
              Date de validité :{" "}
              <span className="font-semibold text-slate-700">
                {fmtDate(validUntil)}
              </span>
            </p>
          )}
          {dueDate && (
            <p className="text-[8px] text-slate-500">
              Échéance :{" "}
              <span className="font-semibold text-[var(--color-brand-accent)]">{fmtDate(dueDate)}</span>
            </p>
          )}
          {type === "avoir" && relatedInvoiceNumber && (
            <p className="text-[8px] text-slate-500 mt-0.5">
              Réf. Facture liée :{" "}
              <span className="font-semibold text-slate-700 font-mono">
                {relatedInvoiceNumber}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Séparateur pleine largeur */}
      <div
        className="w-full h-[2px] mb-4"
        style={{
          background:
            "linear-gradient(90deg, var(--color-brand-primary) 0%, #93c5fd 60%, transparent 100%)",
        }}
      />
    </>
  );
}

