"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Save, Building2, FileText, Percent, Mail, Phone, MapPin, Landmark, Upload, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useStore } from "@/lib/store"
import { toast } from "sonner"

export function SettingsPage() {
  const { settings, setSettings } = useStore()
  const [formData, setFormData] = React.useState(settings)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    setFormData(settings)
  }, [settings])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit
          toast.error("Le logo est trop lourd (max 1Mo)");
          return;
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData({ ...formData, logo: reader.result as string })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to update settings')

      const updatedSettings = await fetch('/api/settings').then(res => res.json())
      setSettings(updatedSettings)
      toast.success("Paramètres enregistrés")
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Configurez votre entreprise et vos préférences de facturation</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Company Info */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Informations de l'entreprise</CardTitle>
            </div>
            <CardDescription>Ces informations apparaîtront sur vos documents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-6 items-start mb-4">
              <div className="space-y-2">
                <Label>Logo de l'entreprise</Label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-secondary/30 overflow-hidden relative group">
                    {formData.logo ? (
                      <>
                        <img src={formData.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                        <button
                          onClick={() => setFormData({ ...formData, logo: "" })}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </>
                    ) : (
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('logo-upload')?.click()}
                      className="text-xs"
                    >
                      {formData.logo ? "Changer le logo" : "Choisir une image"}
                    </Button>
                    <p className="text-[10px] text-muted-foreground italic">PNG, JPG ou SVG (Max 1Mo)</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Nom de l'entreprise</Label>
                <Input
                  id="company-name"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Email professionnel</Label>
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>NIF (Numéro d'Identification Fiscale)</Label>
                <Input
                  value={formData.nif}
                  onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>RCCM</Label>
                <Input
                  value={formData.rccm}
                  onChange={(e) => setFormData({ ...formData, rccm: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="company-address">Adresse siège social</Label>
                <Input
                  id="company-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <Label htmlFor="mentions-legales">Mentions Légales / Notes par défaut</Label>
              <Textarea
                id="mentions-legales"
                value={formData.mentionsLegales || ""}
                onChange={(e) => setFormData({ ...formData, mentionsLegales: e.target.value })}
                placeholder="Ex: Merci de votre confiance. Conditions de paiement..."
                className="bg-secondary/50 border-border min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Taxes & Invoicing */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Fiscalité & Documents</CardTitle>
            </div>
            <CardDescription>Configuration des taux et préfixes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Taux TVA (%)</Label>
                <Input
                  type="number"
                  value={formData.tvaRate}
                  onChange={(e) => setFormData({ ...formData, tvaRate: parseFloat(e.target.value) || 0 })}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Taux CSS (%)</Label>
                <Input
                  type="number"
                  value={formData.cssRate}
                  onChange={(e) => setFormData({ ...formData, cssRate: parseFloat(e.target.value) || 0 })}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Délai paiement (jours)</Label>
                <Input
                  type="number"
                  value={formData.defaultDueDateDays}
                  onChange={(e) => setFormData({ ...formData, defaultDueDateDays: parseInt(e.target.value) || 0 })}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Préfixe Factures</Label>
                <Input
                  value={formData.invoicePrefix}
                  onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Préfixe Devis</Label>
                <Input
                  value={formData.quotePrefix}
                  onChange={(e) => setFormData({ ...formData, quotePrefix: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank Info */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Informations Bancaires</CardTitle>
            </div>
            <CardDescription>Détails pour les virements</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom de la banque</Label>
                <Input
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>IBAN / RIB</Label>
                <Input
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-12 px-8"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Enregistrement..." : "Enregistrer les modifications"}
          </Button>
        </div>
      </div>
    </div>
  )
}
