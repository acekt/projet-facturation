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
  Calculator,
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
  DialogDescription,
} from "@/components/ui/dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

import { useStore, type InvoiceItem, type Quote } from "@/lib/store"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { DocumentPreview } from "@/components/document-preview"

interface QuoteEditorProps {
  onBack: () => void
  editingId?: string | null
}

export function QuoteEditor({ onBack, editingId }: QuoteEditorProps) {
  const clients = useStore((state) => state.clients)
  const settings = useStore((state) => state.settings)
  const setQuotes = useStore((state) => state.setQuotes)
  const services = useStore((state) => state.services)
  const [selectedClient, setSelectedClient] = React.useState<typeof clients[0] | null>(null)
  const [clientSearchOpen, setClientSearchOpen] = React.useState(false)
  const [clientSearch, setClientSearch] = React.useState("")
  const [items, setItems] = React.useState<InvoiceItem[]>([
    { id: "1", description: "", quantity: 1, unitPrice: 0, total: 0 },
  ])
  const [quoteDate, setQuoteDate] = React.useState(new Date().toISOString().split("T")[0])
  const [isDueDateActive, setIsDueDateActive] = React.useState(true)
  const [dueDate, setDueDate] = React.useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split("T")[0]
  })
  const [discount, setDiscount] = React.useState(0)
  const [notes, setNotes] = React.useState(settings.mentionsLegales || "")
  const [isDraft, setIsDraft] = React.useState(true)
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(!!editingId)

  React.useEffect(() => {
    if (editingId) {
      fetch(`/api/quotes/${editingId}`)
        .then(res => res.json())
        .then(data => {
          setSelectedClient(clients.find(c => c.id === data.clientId) || {
            id: data.clientId,
            name: data.clientName,
            email: data.clientEmail,
            phone: '', address: '', status: 'active'
          });
          setItems(data.items);
          setQuoteDate(data.date);
          setDueDate(data.dueDate);
          setDiscount(data.discount);
          setNotes(data.notes || "");
          setIsDraft(data.status === 'draft');
          setIsLoading(false);
        })
        .catch(() => {
          toast.error("Impossible de charger le devis");
          onBack();
        });
    }
  }, [editingId]);

  const TAX_RATE = settings.tvaRate / 100
  const TPS_RATE = (settings as any).tpsRate / 100 || 0.095
  const CSS_RATE = settings.cssRate / 100

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      client.email.toLowerCase().includes(clientSearch.toLowerCase())
  )

  const updateItem = (itemId: string, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const updated = { ...item, [field]: value }
          if (field === "quantity" || field === "unitPrice") {
            if (Number(updated.unitPrice) < 0) updated.unitPrice = 0
            updated.total = (Number(updated.quantity) || 0) * (Number(updated.unitPrice) || 0)
          }

          // Auto-population from catalog
          if (field === "description" && typeof value === 'string') {
            const matchedService = services.find(s => s.name.toLowerCase() === value.toLowerCase());
            if (matchedService) {
                updated.unitPrice = matchedService.unitPrice;
                updated.total = (Number(updated.quantity) || 0) * updated.unitPrice;
            }
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

  const subtotal = Math.round(items.reduce((acc, item) => acc + item.total, 0))
  const netHT = Math.max(0, subtotal - Math.round(discount))
  const cssAmount = Math.round(netHT * CSS_RATE)
  const taxBase = netHT + cssAmount
  const tpsAmount = Math.round(taxBase * TPS_RATE)
  const tvaAmount = Math.round(taxBase * TAX_RATE)
  const total = netHT + cssAmount + tpsAmount + tvaAmount

  const handleSave = async (status: Quote['status']) => {
    if (!selectedClient) {
      toast.error("Veuillez sélectionner un client")
      return
    }

    if (items.some(item => !item.description || item.quantity <= 0 || item.unitPrice < 0)) {
      toast.error("Veuillez remplir correctement tous les articles")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient.id,
          clientName: selectedClient.name,
          clientEmail: selectedClient.email,
          date: quoteDate,
          dueDate,
          items,
          notes,
          discount,
          subtotal,
          taxBase,
          tpsAmount,
          tvaAmount,
          cssAmount,
          total,
          status
        }),
      })

      if (!response.ok) throw new Error('Failed to save quote')

      const newQuotes = await fetch('/api/quotes').then(res => res.json())
      setQuotes(newQuotes)

      toast.success(status === 'draft' ? "Devis enregistré en brouillon" : "Devis créé avec succès")
      onBack()
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement du devis")
    } finally {
      setIsSubmitting(false)
    }
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
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Nouveau Devis</h1>
            <p className="text-muted-foreground mt-1">Créez une proposition commerciale professionnelle</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2 bg-secondary"
            onClick={() => setPreviewOpen(true)}
            disabled={isSubmitting || !selectedClient}
          >
            <Eye className="w-4 h-4" />
            Aperçu
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg shadow-primary/20"
            onClick={() => handleSave(isDraft ? 'draft' : 'sent')}
            disabled={isSubmitting}
          >
            {isDraft ? <Save className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {isDraft ? "Enregistrer" : "Finaliser & Envoyer"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-foreground font-semibold text-base">Informations du Devis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Date d'émission</Label>
                  <Input
                    type="date"
                    value={quoteDate}
                    onChange={(e) => setQuoteDate(e.target.value)}
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-muted-foreground text-sm">Date de validité</Label>
                    <Switch
                      checked={isValidityActive}
                      onCheckedChange={setIsValidityActive}
                      className="scale-75"
                    />
                  </div>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={cn(
                      "bg-secondary border-border text-foreground transition-opacity",
                      !isValidityActive && "opacity-50 pointer-events-none"
                    )}
                    disabled={!isValidityActive}
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
                          <p className="text-muted-foreground font-medium group-hover:text-foreground">Sélectionner un client</p>
                          <p className="text-muted-foreground/60 text-sm">Cliquez pour rechercher dans votre base</p>
                        </div>
                      </div>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border">
                    <DialogHeader>
                      <DialogTitle className="text-foreground">Rechercher un client</DialogTitle>
                      <VisuallyHidden>
                        <DialogDescription>Sélectionnez un client dans votre base de données pour ce devis</DialogDescription>
                      </VisuallyHidden>
                    </DialogHeader>
                    <div className="mt-4 space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Nom ou email..."
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          className="pl-10 bg-secondary border-border text-foreground"
                        />
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {filteredClients.map((client) => (
                          <button
                            key={client.id}
                            onClick={() => {
                              setSelectedClient(client)
                              setClientSearchOpen(false)
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                          >
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-[10px]">
                                {client.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="text-foreground font-medium text-sm">{client.name}</p>
                              <p className="text-muted-foreground text-xs">{client.email}</p>
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
                <CardTitle className="text-foreground font-semibold text-base">Prestations & Produits</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addItem}
                  className="text-primary hover:text-primary hover:bg-primary/10"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter une ligne
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-4 px-3 text-sm text-muted-foreground mb-2 hidden md:grid">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-right">Qté</div>
                  <div className="col-span-2 text-right">Prix Unitaire</div>
                  <div className="col-span-2 text-right">Total HT</div>
                </div>

                {items.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 md:gap-4 items-start p-3 rounded-xl bg-muted/30">
                    <div className="col-span-12 md:col-span-6">
                      <Select
                        onValueChange={(val) => updateItem(item.id, "description", val)}
                        value={item.description}
                      >
                        <SelectTrigger className="bg-transparent border-0 md:border md:bg-secondary focus:ring-1 text-foreground">
                          <SelectValue placeholder="Sélectionner un service..." />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {services.map(s => (
                            <SelectItem key={s.id} value={s.name}>
                              <div className="flex flex-col">
                                <span className="font-medium">{s.name}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{s.category} • {formatCurrency(s.unitPrice)}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                        className="text-right"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="text-right"
                      />
                    </div>
                    <div className="col-span-3 md:col-span-1 text-right pt-2 font-medium">
                      {formatCurrency(item.total)}
                    </div>
                    <div className="col-span-1 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="text-muted-foreground hover:text-destructive"
                        disabled={items.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-border sticky top-24">
            <CardHeader className="pb-4">
              <CardTitle className="text-foreground font-semibold text-base">Récapitulatif Financier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total HT Brut</span>
                  <span className="text-foreground font-medium">{formatCurrency(subtotal)}</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground">Remise Commerciale</span>
                    <Input
                      type="number"
                      className="w-24 h-7 text-right text-sm"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50">
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Net HT</span>
                    <span>{formatCurrency(netHT)}</span>
                  </div>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">CSS ({settings.cssRate}%)</span>
                  <span className="text-foreground">{formatCurrency(cssAmount)}</span>
                </div>

                <div className="pt-1 border-t border-dashed border-border/30">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-muted-foreground">Base TVA</span>
                    <span>{formatCurrency(taxBase)}</span>
                  </div>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">TPS ({(settings as any).tpsRate || 9.5}%)</span>
                  <span className="text-foreground">{formatCurrency(tpsAmount)}</span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">TVA ({settings.tvaRate}%)</span>
                  <span className="text-foreground">{formatCurrency(tvaAmount)}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-foreground font-bold">TOTAL TTC (XAF)</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(total)}</span>
                </div>
              </div>

                <div className="pt-4 space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                    <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Mode Brouillon</Label>
                        <p className="text-[10px] text-muted-foreground">Le devis pourra être modifié plus tard</p>
                    </div>
                    <Switch checked={isDraft} onCheckedChange={setIsDraft} />
                  </div>
                <Button
                    onClick={() => handleSave(isDraft ? 'draft' : 'sent')}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12"
                  disabled={isSubmitting}
                >
                    {isDraft ? <Save className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    {isDraft ? "Enregistrer en brouillon" : "Générer le Devis"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {previewOpen && selectedClient && (
        <DocumentPreview
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          type="Quote"
          data={{
            clientName: selectedClient.name,
            clientEmail: selectedClient.email,
            date: quoteDate,
            dueDate: dueDate,
            items: items,
            subtotal: subtotal,
            discount: discount,
            taxBase: taxBase,
            tpsAmount: tpsAmount,
            tvaAmount: tvaAmount,
            cssAmount: cssAmount,
            total: total,
            notes: notes
          }}
        />
      )}
    </motion.div>
  )
}
