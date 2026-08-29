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
  // On utilise fr-FR pour le séparateur de milliers, puis on remplace tout espace
  // (incluant l'espace fine insécable \u202F) par un espace insécable classique \u00A0
  // pour éviter tout retour à la ligne non désiré.
  const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  return formatted.replace(/\s/g, '\u00A0') + '\u00A0FCFA';
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
          color: var(--color-brand-secondary) !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .doc-a4 table { border-collapse: collapse; }

        /* Force dark thead in print */
        .doc-a4 .tbl-head tr {
          background-color: var(--color-brand-primary) !important;
        }
        .doc-a4 .tbl-head th {
          color: #ffffff !important;
        }
        /* Force NET À PAYER blue in print */
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
          'doc-a4',
          'bg-white text-black',
          'flex flex-col',
          'p-[12mm]',
          'pb-[40mm]',
          'box-border mx-auto',
          'shadow-2xl print:shadow-none print:m-0',
        ].join(' ')}
        style={{
          width: '210mm',
          minWidth: '210mm',
          minHeight: '297mm',
          height: 'auto',
          color: 'var(--color-brand-secondary)',
          background: '#ffffff',
        }}
      >

        {/* ══════════════════════════════════════════════════════════════════════
            1 · HEADER PREMIUM — Logo + entreprise à gauche | Document à droite
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="flex justify-between items-start mb-4">

          {/* LEFT — Logo + Bloc entreprise */}
          <div className="flex items-start gap-3">
            {s.logo ? (
              <img src={s.logo} alt="Logo" className="h-14 w-auto object-contain flex-shrink-0" />
            ) : (
              <div className="h-14 w-14 rounded-sm bg-brand-primary flex items-center justify-center text-white text-[7px] font-bold tracking-widest flex-shrink-0">
                LOGO
              </div>
            )}
            <div className="flex flex-col justify-center">
              <p className="text-[14px] font-extrabold text-brand-primary uppercase leading-tight tracking-wide">
                {s.companyName || 'NOM ENTREPRISE'}
              </p>
              {s.legalForm && (
                <p className="text-[8px] text-slate-400 font-medium tracking-wider mt-0.5">{s.legalForm}</p>
              )}
              {s.address && (
                <p className="text-[8px] text-slate-500 mt-0.5">{s.address}</p>
              )}
              {(s.phone || s.email) && (
                <p className="text-[8px] text-slate-500 mt-0.5">
                  {[s.phone && `Tél : ${s.phone}`, s.email].filter(Boolean).join('  ·  ')}
                </p>
              )}
            </div>
          </div>

          {/* RIGHT — Type de document + N° complet + Dates */}
          <div className="text-right flex flex-col items-end gap-0.5">
            {/* Label principal : FACTURE / DEVIS / AVOIR */}
            <p className="text-3xl font-black text-slate-800 tracking-tight leading-none uppercase">
              {labelOf(type)}
            </p>
            {/* N° de document avec préfixe redondant */}
            <p className="text-[9px] font-bold text-slate-700 mt-1 tracking-wide">
              {numberLabel(type)}-{data.number}
            </p>
            <div className="w-full h-px bg-slate-200 my-1" />
            <p className="text-[8px] text-slate-500">
              Date d&apos;émission :{' '}
              <span className="font-semibold text-slate-700">{fmtDate(data.date)}</span>
            </p>
            {dueDate && (
              <p className="text-[8px] text-slate-500">
                Échéance :{' '}
                <span className="font-semibold text-[var(--color-brand-accent)]">{fmtDate(dueDate)}</span>
              </p>
            )}
          </div>
        </div>

        {/* Séparateur pleine largeur */}
        <div className="w-full h-[2px] mb-4" style={{ background: 'linear-gradient(90deg, var(--color-brand-primary) 0%, #93c5fd 60%, transparent 100%)' }} />

        {/* ══════════════════════════════════════════════════════════════════════
            2 · BLOCS ÉMETTEUR / DESTINATAIRE — Grille ouverte premium
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 gap-8 mb-4">

          {/* ─ GAUCHE : ÉMETTEUR ─ */}
          <div className="bg-slate-50 rounded px-4 py-3">
            <p className="text-[9px] uppercase tracking-widest text-slate-400 mb-1">
              Émetteur
            </p>
            <p className="text-[11px] font-extrabold text-brand-primary leading-tight">
              {s.companyName || '—'}
            </p>
            {s.legalForm && (
              <p className="text-[8px] text-slate-400 font-medium mt-0.5">{s.legalForm}</p>
            )}
            <div className="mt-2 space-y-0.5 text-[8.5px] text-slate-600">
              {s.nif    && <p><span className="font-semibold text-slate-700">NIF :</span> {s.nif}</p>}
              {s.rccm   && <p><span className="font-semibold text-slate-700">RCCM :</span> {s.rccm}</p>}
              {s.address && <p className="text-slate-500 mt-1">{s.address}</p>}
              {s.phone  && <p className="text-slate-500">Tél : {s.phone}</p>}
            </div>
          </div>

          {/* ─ DROITE : DESTINATAIRE ─ */}
          <div className="bg-slate-50 rounded px-4 py-3">
            <p className="text-[9px] uppercase tracking-widest text-slate-400 mb-1">
              Destinataire
            </p>
            <p className="text-[11px] font-extrabold text-brand-primary leading-tight">
              {data.clientName}
            </p>
            {clientEmail && (
              <p className="text-[8.5px] text-slate-500 mt-0.5">{clientEmail}</p>
            )}
            {/* Séparateur discret avant l'objet */}
            <div className="border-t border-slate-200 mt-2 pt-2">
              <p className="text-[8.5px] text-slate-600">
                <span className="font-semibold text-slate-700">Objet :</span>{' '}
                {notes || reason || 'Prestations de services'}
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            3 · ITEMS TABLE — flex-grow pushes footer to the bottom
            table-fixed + colgroup locks column widths
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="flex-grow min-h-0">
          <table className="w-full table-fixed border-collapse" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '50%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead className="table-header-group tbl-head">
              <tr style={{ backgroundColor: 'var(--color-brand-secondary)' }}>
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
                  style={{ backgroundColor: '#fff' }}
                >
                  <td className="py-3 px-3 align-top font-medium text-slate-800 break-words whitespace-normal text-[11px] leading-relaxed">{item.description}</td>
                  <td className="py-3 px-3 text-center tabular-nums text-slate-600 align-top text-[11px] leading-relaxed">{item.quantity}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-slate-600 align-top text-[11px] leading-relaxed">{fmt(item.unitPrice)}</td>
                  <td className="py-3 px-3 text-right tabular-nums font-bold text-slate-800 align-top text-[11px] leading-relaxed">{fmt(item.total)}</td>
                </tr>
              ))}
              {/* Padding rows to fill minimum height */}
              {Array.from({ length: padRows }).map((_, i) => (
                <tr key={`pad-${i}`} className="border-b border-gray-100 print:break-inside-avoid" style={{ backgroundColor: '#fff' }}>
                  <td className="py-3 px-3 text-transparent select-none break-words text-[11px]" aria-hidden="true">.</td>
                  <td className="py-3 px-3" />
                  <td className="py-3 px-3" />
                  <td className="py-3 px-3" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            4 · GRILLE INFÉRIEURE — Coordonnées bancaires & Signatures (gauche) | Totaux (droite)
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 mt-auto pt-6 gap-8">

          {/* ─ COLONNE GAUCHE : BANQUE & SIGNATURE ─ */}
          <div className="flex flex-col gap-4">
            {/* Encadré Bancaire */}
            <div className="border border-slate-200 rounded px-3 py-2.5 bg-slate-50">
              <p className="text-[8px] font-bold uppercase tracking-widest text-brand-primary mb-2">
                Coordonnées pour Virement Bancaire
              </p>
              <div className="text-[8.5px] text-slate-600 space-y-0.5">
                {s.bankName      && <p><span className="font-semibold text-slate-700">Banque :</span> {s.bankName}</p>}
                {s.bankAgency    && <p><span className="font-semibold text-slate-700">Agence :</span> {s.bankAgency}</p>}
                {s.accountNumber && <p><span className="font-semibold text-slate-700">N° Compte :</span> {s.accountNumber}</p>}
                {s.swiftCode     && <p><span className="font-semibold text-slate-700">SWIFT/BIC :</span> {s.swiftCode}</p>}
                {s.iban          && <p><span className="font-semibold text-slate-700">IBAN/RIB :</span> <span className="font-mono text-[8px]">{s.iban}</span></p>}
              </div>
            </div>

            {/* Conditions de règlement */}
            <div className="text-[8.5px] text-slate-500 flex flex-col gap-0.5">
              <p><span className="font-semibold text-slate-700">Règlement :</span> Espèces · Chèques · Virements</p>
              <p><span className="font-semibold text-slate-700">Délais :</span> Au comptant</p>
            </div>

            {/* Signature */}
            <div className="mt-4">
              <p className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">La Direction</p>
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
                  <span className="font-semibold text-slate-800 tabular-nums">{fmt(data.subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Remise</span>
                    <span className="font-semibold text-slate-600 tabular-nums">− {fmt(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Net HT</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{fmt(netHT)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">CSS ({s.cssRate ?? 1}%)</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{fmt(data.cssAmount)}</span>
                </div>
                {tpsAmt > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">TPS ({s.tpsRate ?? 9.5}%)</span>
                    <span className="font-semibold text-slate-800 tabular-nums">{fmt(tpsAmt)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">TVA ({s.tvaRate ?? 18}%)</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{fmt(data.tvaAmount)}</span>
                </div>
              </div>

              {/* LOGIQUE CONDITIONNELLE (DEVIS vs FACTURE/AVOIR) */}
              {type === 'devis' ? (
                // Ligne finale DEVIS
                <div className="mt-2 bg-slate-50 p-3 rounded-lg flex justify-between items-center print:break-inside-avoid">
                  <span className="text-[14px] font-extrabold text-slate-800 uppercase tracking-widest">
                    Net à Payer
                  </span>
                  <span className="text-[14px] font-extrabold text-slate-800 tabular-nums leading-none">
                    {fmt(data.total)}
                  </span>
                </div>
              ) : (
                // Bloc complet FACTURE / AVOIR
                <div className="mt-2">
                  <div className="bg-brand-primary rounded px-3 py-2.5 flex justify-between items-center net-box">
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                      Total TTC
                    </span>
                    <span className="text-[14px] font-extrabold text-white tabular-nums leading-none">
                      {fmt(data.total)}
                    </span>
                  </div>

                  {/* Lignes de paiements (Réglé & Reste) */}
                  <div className="mt-2 text-[9px] flex flex-col gap-1.5 px-1 pt-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Réglé</span>
                      <span className="text-slate-600 font-semibold tabular-nums">{fmt(totalPaid)}</span>
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

        {/* ══════════════════════════════════════════════════════════════════════
            5 · FOOTER LÉGAL ABSOLU — Identité | Banque | Réf fiscale
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="fixed bottom-0 left-0 w-full px-[15mm] pb-[15mm] text-center bg-white text-[8px] text-gray-500">
          {/* Ligne décorative */}
          <div className="w-12 h-[2px] mx-auto mb-2" style={{ backgroundColor: 'var(--color-brand-primary)' }} />

          {/* Ligne 1 : Identité complète de l'entreprise */}
          <p className="text-[8px] text-slate-400 text-center leading-tight">
            {[
              s.companyName,
              s.legalForm,
              s.nif   ? `NIF : ${s.nif}`   : null,
              s.rccm  ? `RCCM : ${s.rccm}` : null,
              s.phone ? `Tél : ${s.phone}` : null,
              s.email ? s.email            : null,
            ].filter(Boolean).join(' | ')}
          </p>

          {/* Ligne 2 : Coordonnées bancaires */}
          {(s.bankName || s.accountNumber) && (
            <p className="text-[8px] text-slate-400 text-center leading-tight mt-0.5">
              {[s.bankName && `Banque : ${s.bankName}`, s.accountNumber && `N° Compte : ${s.accountNumber}`, s.iban && `IBAN : ${s.iban}`].filter(Boolean).join(' | ')}
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

      </div>
    </>
  )
}
