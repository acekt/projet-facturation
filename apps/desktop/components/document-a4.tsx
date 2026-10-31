"use client";

import * as React from "react";
import { useStore } from "@/lib/store";
import type {
  InvoiceResponse,
  QuoteResponse,
  CreditNoteResponse,
} from "@/lib/types/api";
import { A4Header, type DocumentType } from "@/components/features/document-a4/A4Header";
import { A4FiscalSummary } from "@/components/features/document-a4/A4FiscalSummary";
import { A4Footer } from "@/components/features/document-a4/A4Footer";

// ─── Types ────────────────────────────────────────────────────────────────────

type SupportedDocument = InvoiceResponse | QuoteResponse | CreditNoteResponse;

export interface DocumentA4Props {
  data: SupportedDocument;
  type: DocumentType;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
  return formatted.replace(/\s/g, "\u00A0") + "\u00A0FCFA";
}

function buildHash(doc: SupportedDocument, type: string): string {
  const raw = `${type}-${doc.number}-${doc.date}-${doc.total}-${doc.clientId}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (h << 5) - h + raw.charCodeAt(i);
    h = h & h;
  }
  const hex = Math.abs(h).toString(16).toUpperCase().padStart(8, "0");
  return `DGI-VAL-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${(Math.round(doc.total) % 997).toString().padStart(3, "0")}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentA4({ data, type }: DocumentA4Props) {
  const s = useStore((x) => x.settings);
  const invoices = useStore((x) => x.invoices);

  const relatedInvoiceNumber = React.useMemo(() => {
    if (type !== "avoir" || !("invoiceId" in data)) return undefined;
    const inv = invoices.find((i) => i.id === (data as CreditNoteResponse).invoiceId);
    return inv?.number || (data as CreditNoteResponse).invoiceId;
  }, [type, data, invoices]);

  const payments =
    "payments" in data ? ((data as InvoiceResponse).payments ?? []) : [];
  const totalPaid = payments.reduce((a, p) => a + p.amount, 0);
  const remaining = data.total - totalPaid;
  const dueDate =
    "dueDate" in data ? (data as InvoiceResponse).dueDate : undefined;
  const discount =
    "discount" in data ? (data as InvoiceResponse | QuoteResponse).discount : 0;
  const notes =
    "notes" in data
      ? (data as InvoiceResponse | QuoteResponse).notes
      : undefined;
  const subject =
    "subject" in data
      ? (data as InvoiceResponse | QuoteResponse).subject
      : undefined;
  const validUntil =
    "validUntil" in data ? (data as QuoteResponse).validUntil : undefined;
  const reason =
    "reason" in data ? (data as CreditNoteResponse).reason : undefined;
  const clientEmail =
    "clientEmail" in data
      ? (data as InvoiceResponse | QuoteResponse).clientEmail
      : undefined;
  const tpsAmt = data.tpsAmount ?? 0;
  const netHT = data.taxBase - data.cssAmount;
  const hash = buildHash(data, type);

  // Minimum visible rows in the table body
  const MIN_ROWS = 8;
  const padRows = Math.max(0, MIN_ROWS - data.items.length);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        .doc-a4 {
          font-family: 'Inter', 'Arial', sans-serif !important;
          background: #ffffff !important;
          color: var(--color-brand-secondary) !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .doc-a4 table { border-collapse: collapse; }

        .doc-a4 .tbl-head tr {
          background-color: var(--color-brand-primary) !important;
        }
        .doc-a4 .tbl-head th {
          color: #ffffff !important;
        }
        .doc-a4 .net-box {
          background-color: var(--color-brand-primary) !important;
        }
        .doc-a4 .net-box * {
          color: #ffffff !important;
        }

        @page { size: A4 portrait; margin: 0mm; }

        @media print {
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden; }
          .doc-a4, .doc-a4 * { visibility: visible; }
          .doc-a4 {
            position: absolute !important; left: 0; top: 0;
            width: 210mm !important; height: 297mm !important;
            padding: 12mm !important; margin: 0 !important;
            box-shadow: none !important;
          }
          .no-print, nav, aside, button, header,
          .sidebar, .topbar, [data-sidebar] { display: none !important; }
        }
      `}</style>

      {/* ── A4 SHEET ─────────────────────────────────────────────────────────── */}
      <div
        id="printable-a4-document"
        className={[
          "doc-a4",
          "bg-white text-black",
          "flex flex-col",
          "p-[12mm]",
          "pb-[12mm]",
          "box-border mx-auto",
          "shadow-2xl print:shadow-none print:m-0",
        ].join(" ")}
        style={{
          width: "210mm",
          minWidth: "210mm",
          minHeight: "297mm",
          height: "auto",
          color: "var(--color-brand-secondary)",
          background: "#ffffff",
        }}
      >
        {/* 1 · HEADER */}
        <A4Header
          settings={s}
          type={type}
          docNumber={data.number}
          docDate={data.date}
          validUntil={validUntil}
          dueDate={dueDate}
          relatedInvoiceNumber={relatedInvoiceNumber}
        />

        {/* 2 · DESTINATAIRE & OBJET */}
        <div className="flex justify-end mb-4">
          <div className="bg-slate-50 rounded px-4 py-3">
            <p className="text-[9px] uppercase tracking-widest text-slate-400 mb-1">
              Destinataire
            </p>
            <p className="text-[11px] font-extrabold text-brand-primary leading-tight">
              {data.clientName}
            </p>
            {clientEmail && (
              <p className="text-[8.5px] text-slate-500 mt-0.5">
                {clientEmail}
              </p>
            )}
          </div>
        </div>

        {((type === "avoir" && (reason || subject)) || (type !== "avoir" && Boolean(subject && subject.trim() !== ""))) && (
          <div className="mb-4">
            <p className="text-[11px] text-slate-800">
              <span className="font-bold">{type === "avoir" ? "Motif de l'avoir :" : "Objet :"}</span>{" "}
              <span className="font-semibold">
                {type === "avoir" ? (reason || subject) : subject}
              </span>
            </p>
          </div>
        )}

        {/* 3 · ITEMS TABLE */}
        <div className="flex-grow min-h-0">
          <table
            className="w-full table-fixed border-collapse"
            style={{ tableLayout: "fixed", borderCollapse: "collapse" }}
          >
            <colgroup>
              <col style={{ width: "50%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead className="table-header-group tbl-head">
              <tr style={{ backgroundColor: "var(--color-brand-secondary)" }}>
                <th className="text-left py-2.5 px-3 font-bold uppercase tracking-widest text-white text-[10px]">
                  Désignation
                </th>
                <th className="text-center py-2.5 px-3 font-bold uppercase tracking-widest text-white text-[10px]">
                  Qté
                </th>
                <th className="text-right py-2.5 px-3 font-bold uppercase tracking-widest text-white text-[10px]">
                  P.U (HT)
                </th>
                <th className="text-right py-2.5 px-3 font-bold uppercase tracking-widest text-white text-[10px]">
                  Total (HT)
                </th>
              </tr>
            </thead>
            <tbody className="table-row-group">
              {data.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-100 print:break-inside-avoid"
                  style={{ backgroundColor: "#fff" }}
                >
                  <td className="py-3 px-3 align-top font-medium text-slate-800 break-words whitespace-normal text-[11px] leading-relaxed">
                    {item.description}
                  </td>
                  <td className="py-3 px-3 text-center tabular-nums text-slate-600 align-top text-[11px] leading-relaxed">
                    {item.quantity}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-slate-600 align-top text-[11px] leading-relaxed">
                    {fmt(item.unitPrice)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums font-bold text-slate-800 align-top text-[11px] leading-relaxed">
                    {fmt(item.total)}
                  </td>
                </tr>
              ))}
              {Array.from({ length: padRows }).map((_, i) => (
                <tr
                  key={`pad-${i}`}
                  className="border-b border-gray-100 print:break-inside-avoid"
                  style={{ backgroundColor: "#fff" }}
                >
                  <td
                    className="py-3 px-3 text-transparent select-none break-words text-[11px]"
                    aria-hidden="true"
                  >
                    .
                  </td>
                  <td className="py-3 px-3" />
                  <td className="py-3 px-3" />
                  <td className="py-3 px-3" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4 · TOTAUX & FISCALITÉ */}
        <A4FiscalSummary
          settings={s}
          type={type}
          subtotal={data.subtotal}
          discount={discount}
          netHT={netHT}
          cssAmount={data.cssAmount}
          tpsAmount={tpsAmt}
          tvaAmount={data.tvaAmount}
          total={data.total}
          totalPaid={totalPaid}
          remaining={remaining}
          formatCurrency={fmt}
          notes={notes || s.mentionsLegales}
        />

        {/* 5 · FOOTER LÉGAL */}
        <A4Footer settings={s} hash={hash} />
      </div>
    </>
  );
}
