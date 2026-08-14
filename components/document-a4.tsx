"use client"

import * as React from "react"
import { useStore } from "@/lib/store"
import type { InvoiceResponse, QuoteResponse, CreditNoteResponse } from "@/lib/types/api"

// ─── Types ────────────────────────────────────────────────────────────────────

type SupportedDocument = InvoiceResponse | QuoteResponse | CreditNoteResponse
type DocumentType = 'facture' | 'devis' | 'avoir'

export interface DocumentA4Props {
  data: SupportedDocument
  type: DocumentType
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' FCFA'
}

function fmtDate(s: string): string {
  if (!s) return ''
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(s))
  } catch { return s }
}

function labelOf(type: DocumentType) {
  return type === 'facture' ? 'FACTURE' : type === 'devis' ? 'DEVIS' : 'AVOIR'
}

function numberLabel(type: DocumentType) {
  return type === 'facture' ? 'N° FAC' : type === 'devis' ? 'N° DEV' : 'N° AV'
}

function buildHash(doc: SupportedDocument, type: string): string {
  const raw = `${type}-${doc.number}-${doc.date}-${doc.total}-${doc.clientId}`
  let h = 0
  for (let i = 0; i < raw.length; i++) { h = ((h << 5) - h) + raw.charCodeAt(i); h = h & h }
  const hex = Math.abs(h).toString(16).toUpperCase().padStart(8, '0')
  return `DGI-VAL-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${(Math.round(doc.total) % 997).toString().padStart(3, '0')}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentA4({ data, type }: DocumentA4Props) {
  const s = useStore((x) => x.settings)

  const payments    = 'payments' in data ? (data as InvoiceResponse).payments ?? [] : []
  const totalPaid   = payments.reduce((a, p) => a + p.amount, 0)
  const remaining   = data.total - totalPaid
  const dueDate     = 'dueDate' in data ? (data as InvoiceResponse).dueDate : undefined
  const discount    = 'discount' in data ? (data as InvoiceResponse | QuoteResponse).discount : 0
  const notes       = 'notes' in data ? (data as InvoiceResponse | QuoteResponse).notes : undefined
  const reason      = 'reason' in data ? (data as CreditNoteResponse).reason : undefined
  const clientEmail = 'clientEmail' in data ? (data as InvoiceResponse | QuoteResponse).clientEmail : undefined
  const tpsAmt      = data.tpsAmount ?? 0
  const netHT       = data.taxBase - data.cssAmount
  const hash        = buildHash(data, type)

  // Minimum visible rows in the table body
  const MIN_ROWS = 8
  const padRows  = Math.max(0, MIN_ROWS - data.items.length)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        /* ── Scoped to .doc-a4 only ── */
        .doc-a4 {
          font-family: 'Inter', 'Arial', sans-serif !important;
          background: #ffffff !important;
          color: #1e293b !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .doc-a4 table { border-collapse: collapse; }

        /* Force dark thead in print */
        .doc-a4 .tbl-head tr {
          background-color: #1e3a5f !important;
        }
        .doc-a4 .tbl-head th {
          color: #ffffff !important;
        }
        /* Force NET À PAYER blue in print */
        .doc-a4 .net-box {
          background-color: #1e3a5f !important;
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
        className={[
          'doc-a4',
          'bg-white text-black',
          'flex flex-col',
          'p-[12mm]',
          'box-border mx-auto',
          'shadow-2xl print:shadow-none print:m-0',
        ].join(' ')}
        style={{
          width: '210mm',
          minWidth: '210mm',
          minHeight: '297mm',
          color: '#1e293b',
          background: '#ffffff',
        }}
      >

        {/* ══════════════════════════════════════════════════════════════════════
            1 · HEADER — Logo + Company left, Document label right
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="flex justify-between items-start mb-3">

          {/* LEFT — Logo + company block */}
          <div className="flex items-start gap-3">
            {s.logo ? (
              <img src={s.logo} alt="Logo" className="h-12 w-auto object-contain flex-shrink-0" />
            ) : (
              <div className="h-12 w-12 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-[7px] font-bold flex-shrink-0">
                LOGO
              </div>
            )}
            <div>
              <p className="text-[13px] font-bold text-slate-900 uppercase leading-tight tracking-wide">
                {s.companyName || 'NOM ENTREPRISE'}
              </p>
              {s.legalForm  && <p className="text-[8px] text-slate-400 font-medium">{s.legalForm}</p>}
              {s.address    && <p className="text-[8px] text-slate-500 mt-0.5">{s.address}</p>}
              {(s.email || s.phone) && (
                <p className="text-[8px] text-slate-500">
                  {[s.email, s.phone].filter(Boolean).join('    ')}
                </p>
              )}
            </div>
          </div>

          {/* RIGHT — Document type + number + date */}
          <div className="text-right">
            <p className="text-[28px] font-extrabold text-[#1e3a5f] tracking-widest leading-none">
              {labelOf(type)}
            </p>
            <p className="text-[9px] font-semibold text-slate-600 mt-1">
              {numberLabel(type)}-{data.number}
            </p>
            <p className="text-[8px] text-slate-500 mt-0.5">
              Date d&apos;émission : <span className="font-medium text-slate-700">{fmtDate(data.date)}</span>
            </p>
            {dueDate && (
              <p className="text-[8px] text-slate-500">
                Échéance : <span className="font-medium text-slate-700">{fmtDate(dueDate)}</span>
              </p>
            )}
          </div>
        </div>

        {/* Thin separator */}
        <div className="border-t border-slate-200 mb-3" />

        {/* ══════════════════════════════════════════════════════════════════════
            2 · ADDRESSES — Émetteur | Destinataire in a bordered grid
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 border border-slate-200 rounded mb-3">

          <div className="px-4 py-2.5 border-r border-slate-200">
            <p className="text-[7px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Émetteur</p>
            <p className="text-[10px] font-bold text-[#1e3a5f]">{s.companyName}</p>
            {s.nif  && <p className="text-[8.5px] text-slate-600 mt-0.5">NIF : <span className="font-medium text-slate-700">{s.nif}</span></p>}
            {s.rccm && <p className="text-[8.5px] text-slate-600">RCCM : <span className="font-medium text-slate-700">{s.rccm}</span></p>}
            {s.address && <p className="text-[8.5px] text-slate-500 mt-0.5">{s.address}</p>}
          </div>

          <div className="px-4 py-2.5">
            <p className="text-[7px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Destinataire</p>
            <p className="text-[10px] font-bold text-[#1e3a5f]">{data.clientName}</p>
            {clientEmail && <p className="text-[8.5px] text-slate-500">{clientEmail}</p>}
            <div className="mt-0.5 text-[8.5px] text-slate-600 space-y-0.5">
              <p>Objet : <span className="font-medium text-slate-700">{notes || reason || 'Prestations de services'}</span></p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            3 · ITEMS TABLE — flex-grow pushes footer to the bottom
            table-fixed + colgroup locks column widths
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="flex-grow min-h-0">
          <table className="w-full table-fixed border-collapse text-[8.5px]" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '50%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead className="tbl-head">
              <tr style={{ backgroundColor: '#1e3a5f' }}>
                <th className="text-left py-2 px-3 font-semibold uppercase tracking-wider text-white text-[8px]">
                  Désignation
                </th>
                <th className="text-right py-2 px-3 font-semibold uppercase tracking-wider text-white text-[8px]">
                  Qté
                </th>
                <th className="text-right py-2 px-3 font-semibold uppercase tracking-wider text-white text-[8px]">
                  P.U (HT)
                </th>
                <th className="text-right py-2 px-3 font-semibold uppercase tracking-wider text-white text-[8px]">
                  Total (HT)
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr
                  key={item.id}
                  style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc' }}
                >
                  <td className="py-1.5 px-3 align-top font-medium text-slate-800 break-words whitespace-normal">{item.description}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums text-slate-600 align-top">{item.quantity}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums text-slate-600 align-top">{fmt(item.unitPrice)}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums font-semibold text-slate-800 align-top">{fmt(item.total)}</td>
                </tr>
              ))}
              {/* Padding rows to fill minimum height */}
              {Array.from({ length: padRows }).map((_, i) => (
                <tr key={`pad-${i}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td className="py-1.5 px-3 text-transparent select-none break-words" aria-hidden="true">.</td>
                  <td className="py-1.5 px-3" />
                  <td className="py-1.5 px-3" />
                  <td className="py-1.5 px-3" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            4 · BOTTOM SECTION — Bank info + Signature (left) | Totals (right)
            This mirrors exactly the reference PDF layout.
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="flex gap-4 mt-3">

          {/* ── LEFT COLUMN — Bank + Payment terms + Signature ── */}
          <div className="flex-1 flex flex-col gap-2">

            {/* Bank info box */}
            <div className="border border-slate-200 rounded p-2.5">
              <p className="text-[7px] font-bold uppercase tracking-widest text-[#1e3a5f] mb-1.5">
                Coordonnées pour Virement Bancaire
              </p>
              <div className="text-[8px] text-slate-600 space-y-0.5">
                {s.bankName      && <p><span className="font-semibold text-slate-700">Banque :</span> {s.bankName}</p>}
                {s.bankAgency    && <p><span className="font-semibold text-slate-700">Agence :</span> {s.bankAgency}</p>}
                {s.accountNumber && <p><span className="font-semibold text-slate-700">N° Compte :</span> {s.accountNumber}</p>}
                {s.swiftCode     && <p><span className="font-semibold text-slate-700">SWIFT/BIC :</span> {s.swiftCode}</p>}
                {s.iban          && <p><span className="font-semibold text-slate-700">IBAN/RIB :</span> <span className="font-mono text-[7.5px]">{s.iban}</span></p>}
              </div>
            </div>

            {/* Payment terms */}
            <div className="text-[8px] text-slate-500">
              <p>
                <span className="font-semibold text-slate-700">Règlement :</span>{' '}
                Espèces · Chèques · Virements
              </p>
              <p>
                <span className="font-semibold text-slate-700">Délais :</span> Au comptant
              </p>
            </div>

            {/* Signature zone */}
            <div className="mt-auto pt-2">
              <p className="text-[9px] font-bold text-slate-700">La Direction</p>
              <div className="border-b border-slate-400 w-28 mt-6 mb-0.5" />
              <p className="text-[7.5px] text-slate-400">Signature</p>
            </div>
          </div>

          {/* ── RIGHT COLUMN — Vertical totals list + NET À PAYER box ── */}
          <div style={{ width: '220px', flexShrink: 0 }}>

            {/* Totals rows */}
            <div className="text-[8.5px]">
              {/* Brut HT */}
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Brut HT</span>
                <span className="font-semibold text-slate-800 tabular-nums">{fmt(data.subtotal)}</span>
              </div>

              {/* Remise (only if > 0) */}
              {discount > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Remise</span>
                  <span className="font-semibold text-slate-600 tabular-nums">− {fmt(discount)}</span>
                </div>
              )}

              {/* Net HT */}
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Net HT</span>
                <span className="font-semibold text-slate-800 tabular-nums">{fmt(netHT)}</span>
              </div>

              {/* CSS */}
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">CSS ({s.cssRate ?? 1}%)</span>
                <span className="font-semibold text-slate-800 tabular-nums">{fmt(data.cssAmount)}</span>
              </div>

              {/* TPS (optional) */}
              {tpsAmt > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">TPS ({s.tpsRate ?? 9.5}%)</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{fmt(tpsAmt)}</span>
                </div>
              )}

              {/* TVA */}
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">TVA ({s.tvaRate ?? 18}%)</span>
                <span className="font-semibold text-slate-800 tabular-nums">{fmt(data.tvaAmount)}</span>
              </div>
            </div>

            {/* NET À PAYER — dark navy highlight box */}
            <div
              className="net-box mt-1 rounded px-3 py-2.5 flex justify-between items-center"
              style={{ backgroundColor: '#1e3a5f' }}
            >
              <span className="text-[9px] font-bold text-white uppercase tracking-wide">
                {payments.length > 0 ? 'Total TTC' : 'Net à Payer'}
              </span>
              <span className="text-[14px] font-extrabold text-white tabular-nums leading-none">
                {fmt(data.total)}
              </span>
            </div>

            {/* Partial payments */}
            {payments.length > 0 && (
              <div className="mt-1.5 text-[8px] text-right space-y-0.5">
                <p className="text-slate-500">
                  Réglé : <span className="font-semibold text-slate-700">{fmt(totalPaid)}</span>
                </p>
                <p className="font-bold text-red-600">
                  Reste : {fmt(remaining)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            5 · LEGAL FOOTER — centered, small, gray
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="mt-3 pt-2 border-t border-slate-100 text-center text-[7px] text-slate-400 leading-snug">
          <p>
            {[
              s.companyName,
              s.legalForm,
              s.nif  ? `NIF : ${s.nif}` : null,
              s.rccm ? `RCCM : ${s.rccm}` : null,
              s.phone ? `Tél : ${s.phone}` : null,
              s.email ? `Email : ${s.email}` : null,
            ].filter(Boolean).join(' | ')}
          </p>
          {(s.bankName && s.accountNumber) && (
            <p className="mt-0.5">
              {s.bankName} — N° {s.accountNumber}{s.iban ? ` | IBAN : ${s.iban}` : ''}
            </p>
          )}
          {s.mentionsLegales && <p className="italic mt-0.5">{s.mentionsLegales}</p>}
          <p className="mt-0.5 font-mono text-slate-300 text-[6.5px]">{hash}</p>
        </div>

      </div>
    </>
  )
}
