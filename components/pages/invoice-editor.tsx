"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  Plus,
  Trash2,
  User,
  Search,
  Printer,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import { useStore, type InvoiceItem, type Invoice } from "@/lib/store"
import { toast } from "sonner"
import { invoiceSchema } from "@/lib/validations"
import { formatCurrency } from "@/lib/utils"

interface InvoiceEditorProps {
  onBack: () => void
}

export function InvoiceEditor({ onBack }: InvoiceEditorProps) {
  const { clients, settings, addInvoice } = useStore()
  const [selectedClient, setSelectedClient] = React.useState<typeof clients[0] | null>(null)
  const [clientSearchOpen, setClientSearchOpen] = React.useState(false)
  const [clientSearch, setClientSearch] = React.useState("")
  const [items, setItems] = React.useState<InvoiceItem[]>([
    { id: "1", description: "", quantity: 1, unitPrice: 0, total: 0 },
  ])
  const [invoiceNumber, setInvoiceNumber] = React.useState(`${settings.invoicePrefix}-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`)
  const [invoiceDate, setInvoiceDate] = React.useState(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = React.useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + settings.defaultDueDateDays)
    return d.toISOString().split("T")[0]
  })
  const [notes, setNotes] = React.useState(settings.mentionsLegales || "")
  const [previewOpen, setPreviewOpen] = React.useState(false)

  const TAX_RATE = settings.tvaRate / 100
  const CSS_RATE = settings.cssRate / 100

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      client.email.toLowerCase().includes(clientSearch.toLowerCase())
  )

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value }
          if (field === "quantity" || field === "unitPrice") {
            updated.total = updated.quantity * updated.unitPrice
          }
          return updated
        }
        return item
      })
    )
  }

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: String(Date.now()), description: "", quantity: 1, unitPrice: 0, total: 0 },
    ])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((item) => item.id !== id))
    }
  }

  const subtotal = items.reduce((acc, item) => acc + item.total, 0)
  const tva = subtotal * TAX_RATE
  const css = subtotal * CSS_RATE
  const total = subtotal + tva + css

  const handleSave = (status: 'draft' | 'pending') => {
    const newInvoice = {
      clientId: selectedClient?.id || "",
      clientName: selectedClient?.name || "",
      clientEmail: selectedClient?.email || "",
      amount: total,
      status,
      date: invoiceDate,
      dueDate,
      items,
      notes,
    }

    const result = invoiceSchema.safeParse(newInvoice);

    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    addInvoice(result.data as Omit<Invoice, 'id'>)
    toast.success(status === 'draft' ? "Brouillon enregistré" : "Facture envoyée avec succès")
    onBack()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Nouvelle facture</h1>
            <p className="text-muted-foreground mt-1">Creez et envoyez une facture professionnelle</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => handleSave('draft')}
          >
            <Save className="w-4 h-4" />
            Brouillon
          </Button>
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Eye className="w-4 h-4" />
                Apercu
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader className="flex flex-row items-center justify-between no-print">
                <DialogTitle className="text-foreground">Apercu de la facture</DialogTitle>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => window.print()}
                >
                  <Printer className="w-4 h-4" />
                  Imprimer
                </Button>
              </DialogHeader>
              <div className="mt-4 bg-white rounded-xl p-8 text-gray-900 print-section">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{settings.companyName}</h2>
                    <p className="text-sm text-gray-500 mt-1">Solutions de facturation premium</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">FACTURE</p>
                    <p className="text-sm text-gray-500">{invoiceNumber}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Facture a</p>
                    {selectedClient ? (
                      <>
                        <p className="font-semibold text-gray-900">{selectedClient.name}</p>
                        <p className="text-sm text-gray-500">{selectedClient.email}</p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">Aucun client selectionne</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="space-y-1">
                      <p className="text-sm"><span className="text-gray-400">Date:</span> {invoiceDate}</p>
                      <p className="text-sm"><span className="text-gray-400">Echeance:</span> {dueDate || "Non definie"}</p>
                    </div>
                  </div>
                </div>

                <table className="w-full mb-8">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 text-xs text-gray-400 uppercase">Description</th>
                      <th className="text-right py-3 text-xs text-gray-400 uppercase">Qte</th>
                      <th className="text-right py-3 text-xs text-gray-400 uppercase">Prix unitaire</th>
                      <th className="text-right py-3 text-xs text-gray-400 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-3 text-sm">{item.description || "—"}</td>
                        <td className="py-3 text-sm text-right">{item.quantity}</td>
                        <td className="py-3 text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-3 text-sm text-right font-medium">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Sous-total</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">TVA ({settings.tvaRate}%)</span>
                      <span>{formatCurrency(tva)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">CSS ({settings.cssRate}%)</span>
                      <span>{formatCurrency(css)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-200 text-xs text-gray-400">
                  <p>Mentions legales: NIF: {settings.nif} | RCCM: {settings.rccm}</p>
                  <p>Delai de paiement: {settings.defaultDueDateDays} jours | Mode de paiement: Airtel Money, Moov Money, Virement bancaire</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button 
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg shadow-primary/20"
            onClick={() => handleSave('pending')}
          >
            <Send className="w-4 h-4" />
            Envoyer
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Info */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-foreground font-semibold text-base">Informations de la facture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Numero de facture</Label>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Date de facturation</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Date d&apos;echeance</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Selection */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-foreground font-semibold text-base">Client</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedClient ? (
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 ring-2 ring-border">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm font-medium">
                        {selectedClient.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-foreground font-medium">{selectedClient.name}</p>
                      <p className="text-muted-foreground text-sm">{selectedClient.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedClient(null)}
                  >
                    Changer
                  </Button>
                </div>
              ) : (
                <Dialog open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                  <DialogTrigger asChild>
                    <button className="w-full p-4 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all text-left group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          <User className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium group-hover:text-foreground">Selectionner un client</p>
                          <p className="text-muted-foreground/60 text-sm">Cliquez pour rechercher</p>
                        </div>
                      </div>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border">
                    <DialogHeader>
                      <DialogTitle className="text-foreground">Selectionner un client</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Rechercher un client..."
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                        />
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {filteredClients.map((client) => (
                          <button
                            key={client.id}
                            onClick={() => {
                              setSelectedClient(client)
                              setClientSearchOpen(false)
                              setClientSearch("")
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                          >
                            <Avatar className="w-10 h-10 ring-2 ring-border">
                              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm">
                                {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="text-foreground font-medium">{client.name}</p>
                              <p className="text-muted-foreground text-sm">{client.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground font-semibold text-base">Articles et services</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addItem}
                  className="text-primary hover:text-primary hover:bg-primary/10"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 px-3 text-sm text-muted-foreground">
                  <div className="col-span-5">Description</div>
                  <div className="col-span-2 text-right">Quantite</div>
                  <div className="col-span-2 text-right">Prix unitaire</div>
                  <div className="col-span-2 text-right">Total</div>
                  <div className="col-span-1"></div>
                </div>

                {/* Items */}
                {items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="grid grid-cols-12 gap-4 items-center p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="col-span-5">
                      <Input
                        placeholder="Description du service..."
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                        className="bg-transparent border-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 p-0 h-auto"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="1"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                        className="bg-transparent border-0 text-foreground text-right focus-visible:ring-0 p-0 h-auto"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="bg-transparent border-0 text-foreground text-right focus-visible:ring-0 p-0 h-auto"
                      />
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-foreground font-semibold">{formatCurrency(item.total)}</span>
                    </div>
                    <div className="col-span-1 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                        disabled={items.length === 1}
                        aria-label="Supprimer l'article"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-foreground font-semibold text-base">Notes et conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Ajoutez des notes ou conditions particulieres..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground min-h-[100px]"
              />
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <Card className="bg-card border-border sticky top-24">
            <CardHeader className="pb-4">
              <CardTitle className="text-foreground font-semibold text-base">Resume</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span className="text-foreground font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA ({settings.tvaRate}%)</span>
                  <span className="text-foreground font-medium">{formatCurrency(tva)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CSS ({settings.cssRate}%)</span>
                  <span className="text-foreground font-medium">{formatCurrency(css)}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex justify-between">
                  <span className="text-foreground font-semibold">Total</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <Button 
                  onClick={() => handleSave('pending')}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20" 
                  size="lg"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Envoyer la facture
                </Button>
                <Button 
                  onClick={() => handleSave('draft')}
                  variant="outline" 
                  className="w-full" 
                  size="lg"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer brouillon
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
