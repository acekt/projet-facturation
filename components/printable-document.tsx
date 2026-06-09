"use client"

import * as React from "react"
import { useStore, type Quote, type Invoice } from "@/lib/store"
import { formatCurrency } from "@/lib/utils"

function generateDocumentHash(doc: Quote | Invoice, type: string) {
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
  const payments = 'payments' in document ? (document as Invoice).payments || [] : []

  return (
    <div className="printable-document p-4 md:p-8 bg-white text-black font-sans min-h-[297mm] w-full max-w-[210mm] mx-auto text-[10pt] md:text-[11pt] leading-normal shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4">
          {settings.logo && (
            <div className="w-16 h-16 overflow-hidden bg-white">
              <img src={settings.logo} alt="Logo" className="w-full h-full object-contain" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold uppercase text-gray-800">{settings.companyName}</h1>
            {settings.legalForm && <p className="text-[8pt] font-bold text-gray-500">{settings.legalForm}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm mb-4">Moanda, le {document.date}</p>
          <div className="border border-black rounded-lg px-6 py-2">
            <h2 className="text-lg font-bold uppercase">{type === 'devis' ? 'DEVIS' : 'FACTURE'}: N°{document.number}</h2>
          </div>
        </div>
      </div>

      {/* Client & Info */}
      <div className="mb-8 space-y-1">
          <p><span className="font-bold">Client:</span> {document.clientName}</p>
          <p><span className="font-bold">Objet:</span> {document.notes || "Prestations de services"}</p>
          <p><span className="font-bold">NIF:</span></p>
          <p><span className="font-bold">BC:</span></p>
      </div>

      {/* Items Table */}
      <table className="w-full mb-8 border-collapse border border-black">
        <thead>
          <tr className="bg-[#8DBE6A] border-b border-black">
            <th className="text-left py-2 px-4 font-bold uppercase text-xs border-r border-black">Désignation</th>
            <th className="text-right py-2 px-4 font-bold uppercase text-xs border-r border-black w-24">Qté</th>
            <th className="text-right py-2 px-4 font-bold uppercase text-xs border-r border-black w-32">Prix Unit</th>
            <th className="text-right py-2 px-4 font-bold uppercase text-xs w-32">Montant</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black">
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

      {/* Totals Grid */}
      <div className="grid grid-cols-7 border border-black mb-8">
        <div className="border-r border-black p-2 text-center">
            <p className="text-[7pt] font-bold uppercase mb-1">Brut HT</p>
            <p className="font-bold text-xs">{formatCurrency(document.subtotal).replace(' XAF', '')}</p>
        </div>
        <div className="border-r border-black p-2 text-center">
            <p className="text-[7pt] font-bold uppercase mb-1">Remise</p>
            <p className="font-bold text-xs">{formatCurrency(document.discount).replace(' XAF', '')}</p>
        </div>
        <div className="border-r border-black p-2 text-center">
            <p className="text-[7pt] font-bold uppercase mb-1">Net HT</p>
            <p className="font-bold text-xs">{formatCurrency(document.taxBase - document.cssAmount).replace(' XAF', '')}</p>
        </div>
        <div className="border-r border-black p-2 text-center">
            <p className="text-[7pt] font-bold uppercase mb-1">CSS</p>
            <p className="font-bold text-xs">{formatCurrency(document.cssAmount).replace(' XAF', '')}</p>
        </div>
        <div className="border-r border-black p-2 text-center">
            <p className="text-[7pt] font-bold uppercase mb-1">TPS {settings.tpsRate}%</p>
            <p className="font-bold text-xs">{formatCurrency(document.tpsAmount || 0).replace(' XAF', '')}</p>
        </div>
        <div className="border-r border-black p-2 text-center">
            <p className="text-[7pt] font-bold uppercase mb-1">TVA {settings.tvaRate}%</p>
            <p className="font-bold text-xs">{formatCurrency(document.tvaAmount).replace(' XAF', '')}</p>
        </div>
        <div className="p-2 text-center bg-gray-50">
            <p className="text-[7pt] font-semibold uppercase mb-1">{payments.length > 0 ? "TOTAL TTC" : "NET A PAYER"}</p>
            <p className="font-semibold text-sm">{formatCurrency(document.total).replace(' XAF', '')}</p>
        </div>
      </div>

      {payments.length > 0 && (
          <div className="flex justify-end mb-8">
              <div className="w-1/3 border border-black p-4 space-y-2">
                <div className="flex justify-between text-xs">
                    <span>Montant déjà réglé:</span>
                    <span className="font-bold">{formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0)).replace(' XAF', '')}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-black pt-2 text-red-600">
                    <span className="font-bold">RESTE À PAYER:</span>
                    <span className="font-semibold underline">{formatCurrency(document.total - payments.reduce((sum, p) => sum + p.amount, 0)).replace(' XAF', '')}</span>
                </div>
              </div>
          </div>
      )}

      {/* Bank Info */}
      <div className="mb-12 p-4 border-2 border-dashed border-gray-200 rounded-xl">
        <h3 className="text-xs font-bold uppercase text-gray-500 mb-2">Coordonnées pour Virement Bancaire</h3>
        <div className="grid grid-cols-2 text-[9pt] gap-y-1">
          <p><span className="font-bold">Banque:</span> {settings.bankName}</p>
          <p><span className="font-bold">Agence:</span> {settings.bankAgency}</p>
          <p><span className="font-bold">N° de Compte:</span> {settings.accountNumber}</p>
          <p><span className="font-bold">SWIFT/BIC:</span> {settings.swiftCode}</p>
          <p className="col-span-2"><span className="font-bold">IBAN:</span> <span className="font-mono">{settings.iban}</span></p>
        </div>
      </div>

      <div className="mb-8">
           <p className="font-bold mb-4">
             Arrêter {type === 'devis' ? 'Le Présent devis' : 'La Présente facture'} à la Somme totale de : ... FCFA TTC
           </p>
           <p className="text-blue-600 text-sm font-bold">N.B:</p>
           <p className="text-red-600 text-sm font-bold">- Les modes de règlement: *Espèces ; *Chèques ; *Virements .</p>
           <p className="text-red-600 text-sm font-bold">- Les délais de règlement: *Au Comptant;</p>
      </div>

      <div className="flex justify-end mb-20 avoid-break">
          <p className="font-bold mr-20">La Direction</p>
      </div>

      {/* Footer */}
      <div className="mt-auto text-center border-t border-gray-200 pt-4 text-[8pt] text-gray-600">
          <p className="font-bold text-black text-sm mb-1">{settings.companyName.toUpperCase()}</p>
          <p>Tél: {settings.phone} | Adresse: {settings.address}</p>
          <p>Email: {settings.email}</p>
          <p>NIF: {settings.nif} / RCCM: {settings.rccm} {settings.bankName ? `| ${settings.bankName} N°: ${settings.accountNumber || settings.iban}` : ''}</p>
      </div>

      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0mm;
        }
        @media print {
          html, body {
            background: white !important;
            color: black !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }
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
            width: 210mm;
            min-height: 297mm;
            padding: 15mm !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }
          .no-print, nav, aside, button, .sidebar, .topbar {
            display: none !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
          .avoid-break {
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  )
}
