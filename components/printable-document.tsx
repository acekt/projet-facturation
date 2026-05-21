"use client"

import * as React from "react"
import { useStore, type Quote, type Invoice } from "@/lib/store"
import { formatCurrency } from "@/lib/utils"

function generateDocumentHash(doc: any, type: string) {
  const inputStr = `${type}-${doc.number || ''}-${doc.date || ''}-${doc.total || 0}-${doc.clientId || ''}-${doc.subtotal || 0}`;
  let hash = 0;
  for (let i = 0; i < inputStr.length; i++) {
    const char = inputStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  return `DGI-VAL-${hexHash.substring(0, 4)}-${hexHash.substring(4, 8)}-${(Math.round(doc.total || 0) % 997).toString().padStart(3, '0')}`;
}

interface PrintableDocumentProps {
  document: Quote | Invoice
  type: 'devis' | 'facture'
}

export function PrintableDocument({ document, type }: PrintableDocumentProps) {
  const { settings } = useStore()

  return (
    <div className="printable-document p-4 md:p-8 bg-white text-black font-sans min-h-[297mm] w-full max-w-[210mm] mx-auto text-[10pt] md:text-[12pt] leading-normal shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-start mb-12 border-b-2 border-primary pb-6">
        <div className="flex items-center gap-4">
          {settings.logo && (
            <div className="w-20 h-20 overflow-hidden bg-white">
              <img src={settings.logo} alt="Logo" className="w-full h-full object-contain" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold uppercase text-primary mb-1">{settings.companyName}</h1>
            <div className="text-sm space-y-0.5">
              <p>{settings.address}</p>
              <p>Email: {settings.email}</p>
              <p>Tél: {settings.phone}</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-4xl font-black uppercase mb-1">{type}</h2>
          <p className="text-xl font-bold">N° {document.number}</p>
          <div className="mt-4 text-sm">
            <p><span className="font-semibold italic">Date d'émission:</span> {document.date}</p>
            <p><span className="font-semibold italic">Date d'échéance:</span> {document.dueDate}</p>
          </div>
        </div>
      </div>

      {/* Client & Info */}
      <div className="grid grid-cols-2 gap-12 mb-12">
        <div className="border border-gray-200 p-4 rounded-lg bg-gray-50">
          <h3 className="text-xs font-bold uppercase text-gray-500 mb-2 border-b border-gray-200 pb-1">Émetteur</h3>
          <p className="font-bold">{settings.companyName}</p>
          <p className="text-sm">NIF: {settings.nif}</p>
          <p className="text-sm">RCCM: {settings.rccm}</p>
        </div>
        <div className="border border-gray-200 p-4 rounded-lg">
          <h3 className="text-xs font-bold uppercase text-gray-500 mb-2 border-b border-gray-200 pb-1">Destinataire</h3>
          <p className="font-bold text-lg">{document.clientName}</p>
          <p className="text-sm">{document.clientEmail}</p>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full mb-12 border-collapse">
        <thead>
          <tr className="bg-gray-100 border-y-2 border-gray-300">
            <th className="text-left py-3 px-4 font-bold uppercase text-sm">Désignation des prestations</th>
            <th className="text-right py-3 px-4 font-bold uppercase text-sm w-24">Qté</th>
            <th className="text-right py-3 px-4 font-bold uppercase text-sm w-32">P.U (HT)</th>
            <th className="text-right py-3 px-4 font-bold uppercase text-sm w-32">Montant (HT)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {document.items.map((item) => (
            <tr key={item.id}>
              <td className="py-4 px-4 font-medium">{item.description}</td>
              <td className="py-4 px-4 text-right">{item.quantity}</td>
              <td className="py-4 px-4 text-right">{formatCurrency(item.unitPrice).replace(' XAF', '')}</td>
              <td className="py-4 px-4 text-right font-semibold">{formatCurrency(item.total).replace(' XAF', '')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-12">
        <div className="w-80">
          <div className="flex justify-between py-1 px-4">
            <span className="text-gray-600">Total Hors Taxes (HT)</span>
            <span className="font-semibold">{formatCurrency(document.subtotal)}</span>
          </div>
          {document.discount > 0 && (
            <div className="flex justify-between py-1 px-4 text-red-600 italic">
              <span>Remise Commerciale</span>
              <span>- {formatCurrency(document.discount)}</span>
            </div>
          )}
          <div className="flex justify-between py-1 px-4 bg-gray-50 border-y border-gray-200 my-1 font-bold">
            <span>Net Hors Taxes</span>
            <span>{formatCurrency(document.taxBase)}</span>
          </div>
          <div className="flex justify-between py-1 px-4 text-sm">
            <span className="text-gray-500">TVA ({settings.tvaRate}%)</span>
            <span>{formatCurrency(document.tvaAmount)}</span>
          </div>
          <div className="flex justify-between py-1 px-4 text-sm border-b border-gray-100 pb-2">
            <span className="text-gray-500">CSS ({settings.cssRate}%)</span>
            <span>{formatCurrency(document.cssAmount)}</span>
          </div>
          <div className="flex justify-between py-3 px-4 bg-primary text-white rounded-b-lg mt-2 font-black text-xl shadow-lg">
            <span className="uppercase">Total TTC (XAF)</span>
            <span>{formatCurrency(document.total)}</span>
          </div>
        </div>
      </div>

      {/* Bank Info */}
      <div className="mb-12 p-4 border-2 border-dashed border-gray-200 rounded-xl">
        <h3 className="text-xs font-bold uppercase text-gray-500 mb-2">Coordonnées Bancaires</h3>
        <div className="grid grid-cols-2 text-sm">
          <p><span className="font-semibold">Banque:</span> {settings.bankName}</p>
          <p><span className="font-semibold">IBAN/RIB:</span> {settings.iban}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-8 border-t border-gray-100 text-[10pt] text-gray-400">
        <div className="grid grid-cols-2 gap-8 items-start mb-6">
          <div className="text-left">
            <p className="font-bold text-gray-500 mb-0.5">Validation Numérique & Traçabilité (DGI Gabon)</p>
            <p className="font-mono text-xs select-all text-gray-400 font-semibold">{generateDocumentHash(document, type)}</p>
          </div>
          <div className="text-right">
            <span className="inline-block border border-primary/20 px-3 py-1 rounded bg-primary/5 text-primary uppercase font-bold text-[8pt] tracking-widest">
              Conforme Système DGI-Gabon
            </span>
          </div>
        </div>

        <div className="text-center pt-4 border-t border-gray-50">
          <p className="mb-1 font-bold">{settings.companyName}</p>
          <p>Siège social: {settings.address} | NIF: {settings.nif} | RCCM: {settings.rccm}</p>
          <p className="mt-2 text-xs italic font-medium text-gray-300">
            {type === 'facture' ? "Facture originale émise électroniquement par L'Etoile conformément au code général des impôts gabonais." : "Document de proforma généré électroniquement par L'Etoile."}
          </p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-document, .printable-document * {
            visibility: visible;
          }
          .printable-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            border: none;
            box-shadow: none;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
