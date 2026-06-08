import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import { InvoiceItem } from "@/lib/store"
import { useStore } from "@/lib/store"

interface DocumentPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'Quote' | 'Invoice'
  data: {
    number?: string
    clientName: string
    clientEmail: string
    date: string
    dueDate: string
    items: InvoiceItem[]
    subtotal: number
    discount: number
    taxBase: number
    tvaAmount: number
    cssAmount: number
    total: number
    notes?: string
  payments?: any[]
  }
}

export function DocumentPreview({ open, onOpenChange, type, data }: DocumentPreviewProps) {
  const { settings } = useStore()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-0 md:p-6">
        <DialogHeader className="print:hidden px-6 pt-6 md:px-0 md:pt-0">
          <DialogTitle className="text-foreground">
            Aperçu du {type === 'Quote' ? 'Devis' : 'Facture'} {data.number ? `- ${data.number}` : '(Brouillon)'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Aperçu complet du document financier avant validation ou impression
          </DialogDescription>
        </DialogHeader>

        <div className="bg-white text-black p-4 md:p-8 rounded-lg shadow-sm font-sans space-y-8 mx-auto w-full max-w-[800px]" id="printable-document">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-gray-200 pb-6">
            <div>
              <h1 className="text-4xl font-bold text-primary tracking-tighter uppercase">
                {type === 'Quote' ? 'DEVIS' : 'FACTURE'}
              </h1>
              {data.number && <p className="text-gray-500 mt-1 font-medium">{data.number}</p>}
            </div>
            <div className="text-right flex flex-col items-end">
              {settings.logo && (
                <div className="w-16 h-16 overflow-hidden bg-white mb-2 flex items-center justify-center border border-gray-100 rounded-lg p-1">
                  <img src={settings.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
              )}
              <h2 className="text-xl font-bold">{settings.companyName}</h2>
              <p className="text-sm text-gray-500 mt-1">{settings.address}</p>
              <p className="text-sm text-gray-500">{settings.email} • {settings.phone}</p>
              <p className="text-sm text-gray-500 mt-2">NIF: {settings.nif} | RCCM: {settings.rccm}</p>
              {settings.legalForm && <p className="text-[10px] text-gray-400 uppercase font-bold">{settings.legalForm}</p>}
            </div>
          </div>

          {/* Info Block */}
          <div className="flex justify-between">
            <div className="space-y-1">
              <p className="text-sm text-gray-500 uppercase font-semibold tracking-wider">Facturé à</p>
              <h3 className="text-lg font-bold">{data.clientName}</h3>
              <p className="text-gray-600">{data.clientEmail}</p>
            </div>
            <div className="space-y-1 text-right">
              <div className="flex justify-end gap-8">
                <div className="text-right">
                  <p className="text-sm text-gray-500 uppercase font-semibold tracking-wider">Date</p>
                  <p className="font-medium">{data.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 uppercase font-semibold tracking-wider">Émission</p>
                  <p className="font-medium">{data.date}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="mt-8">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200 text-sm font-semibold uppercase tracking-wider text-gray-600">
                  <th className="py-3 px-2">Description</th>
                  <th className="py-3 px-2 text-right">Qté</th>
                  <th className="py-3 px-2 text-right">Prix Unitaire</th>
                  <th className="py-3 px-2 text-right">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item, i) => (
                  <tr key={i} className="text-sm">
                    <td className="py-4 px-2 font-medium">{item.description}</td>
                    <td className="py-4 px-2 text-right text-gray-600">{item.quantity}</td>
                    <td className="py-4 px-2 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-4 px-2 text-right font-medium">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end pt-4">
            <div className="w-1/2 space-y-3">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Total HT</span>
                <span className="font-medium">{formatCurrency(data.subtotal)}</span>
              </div>
              {data.discount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Remise</span>
                  <span className="font-medium">-{formatCurrency(data.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-600 border-t border-gray-100 pt-2">
                <span>Base Imposable</span>
                <span className="font-medium">{formatCurrency(data.taxBase)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>TPS ({settings.tpsRate}%)</span>
                <span className="font-medium">{formatCurrency(data.tpsAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>TVA ({settings.tvaRate}%)</span>
                <span className="font-medium">{formatCurrency(data.tvaAmount)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600 border-b border-gray-200 pb-3">
                <span>CSS ({settings.cssRate}%)</span>
                <span className="font-medium">{formatCurrency(data.cssAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-primary pt-1">
                <span>{data.payments && data.payments.length > 0 ? "TOTAL TTC" : "NET À PAYER"}</span>
                <span>{formatCurrency(data.total)}</span>
              </div>

              {data.payments && data.payments.length > 0 && (
                <>
                  <div className="flex justify-between text-sm text-emerald-600 pt-2 border-t border-gray-100">
                    <span>Montant déjà réglé</span>
                    <span className="font-medium">
                        -{formatCurrency(data.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-red-600 pt-1 border-t-2 border-gray-900">
                    <span>RESTE À PAYER</span>
                    <span>{formatCurrency(data.total - data.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0))}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Footer Info */}
          <div className="pt-8 space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-semibold uppercase text-gray-600 mb-1">Informations de Paiement</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <p className="text-xs text-gray-600">Banque: <span className="font-medium text-gray-900">{settings.bankName}</span></p>
                <p className="text-xs text-gray-600">Agence: <span className="font-medium text-gray-900">{settings.bankAgency}</span></p>
                <p className="text-xs text-gray-600">N° Compte: <span className="font-medium text-gray-900">{settings.accountNumber}</span></p>
                <p className="text-xs text-gray-600">SWIFT: <span className="font-medium text-gray-900">{settings.swiftCode}</span></p>
                <p className="text-xs text-gray-600 col-span-2 mt-1">IBAN: <span className="font-medium text-gray-900 font-mono">{settings.iban}</span></p>
              </div>
            </div>

            {data.notes && (
              <div>
                <p className="text-sm font-semibold uppercase text-gray-600 mb-1">Notes / Mentions Légales</p>
                <p className="text-sm text-gray-500 whitespace-pre-wrap">{data.notes}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
