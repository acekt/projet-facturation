"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
    Save, Building2, FileText, Percent, Mail, Phone, MapPin,
    Landmark, Upload, X, ShieldAlert, CloudUpload, Image as ImageIcon
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { useStore } from "@/lib/store"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function SettingsPage() {
  const { settings, setSettings, user } = useStore()
  const [formData, setFormData] = React.useState(settings)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const isAdmin = user?.role === 'admin'

  React.useEffect(() => {
    setFormData(settings)
  }, [settings])

  const validateAndUpload = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
        toast.error("Le fichier est trop volumineux (max 2 Mo)")
        return
    }
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
        toast.error("Format non supporté (PNG, JPG, SVG uniquement)")
        return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
        setFormData({ ...formData, logo: reader.result as string })
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) validateAndUpload(file)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (isAdmin) setIsDragging(true)
  }

  const onDragLeave = () => {
    setIsDragging(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (!isAdmin) return
    const file = e.dataTransfer.files?.[0]
    if (file) validateAndUpload(file)
  }

  const handleSave = async () => {
    if (!isAdmin) return;
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
    <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Paramètres</h1>
          <p className="text-muted-foreground mt-1">Configurez votre entreprise et vos préférences de facturation</p>
        </div>
        {isAdmin ? (
            <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-11 px-6 shadow-lg shadow-primary/20"
            >
                <Save className="w-4 h-4" />
                {isSaving ? "En cours..." : "Enregistrer"}
            </Button>
        ) : (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50">
                <ShieldAlert className="w-4 h-4" />
                <span className="text-sm font-medium">Lecture seule (Opérateur)</span>
            </div>
        )}
      </div>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="bg-secondary p-1 rounded-xl mb-6">
          <TabsTrigger value="company" className="rounded-lg px-6">Entreprise</TabsTrigger>
          <TabsTrigger value="billing" className="rounded-lg px-6">Facturation</TabsTrigger>
          <TabsTrigger value="bank" className="rounded-lg px-6">Banque</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-0">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Identité de l'entreprise</CardTitle>
              </div>
              <CardDescription>Informations légales et logo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="space-y-3 w-full md:w-64">
                  <Label>Logo de l'entreprise</Label>
                  <div
                    onClick={() => isAdmin && fileInputRef.current?.click()}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    className={cn(
                        "relative aspect-square rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center p-4 overflow-hidden",
                        isAdmin ? "cursor-pointer" : "cursor-default",
                        isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-border bg-secondary/30",
                        isAdmin && "hover:border-primary/50 hover:bg-secondary/50",
                        formData.logo && "border-solid border-primary/20 bg-white dark:bg-slate-950"
                    )}
                  >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/png,image/jpeg,image/svg+xml"
                        className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none"
                        disabled={!isAdmin}
                    />

                    {formData.logo ? (
                        <div className="group w-full h-full flex flex-col items-center justify-center gap-2">
                            <img src={formData.logo} alt="Logo preview" className="max-w-full max-h-[140px] object-contain" />
                            {isAdmin && (
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                                    <CloudUpload className="w-8 h-8" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Remplacer</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <CloudUpload className={cn("w-6 h-6", isDragging ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">
                                    {isDragging ? "Déposez ici" : "Cliquez pour uploader"}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-1 px-4">PNG, JPG, SVG jusqu'à 2 Mo</p>
                            </div>
                        </div>
                    )}
                  </div>
                  {formData.logo && isAdmin && (
                    <button
                        onClick={() => setFormData({...formData, logo: ""})}
                        className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 mx-auto transition-colors font-bold uppercase tracking-tighter"
                    >
                        <X className="w-3 h-3" /> Supprimer le logo
                    </button>
                  )}
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Nom Commercial</Label>
                    <Input
                      id="company-name"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="bg-secondary/50 border-border"
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legal-form">Forme Juridique</Label>
                    <Input
                      id="legal-form"
                      value={formData.legalForm}
                      onChange={(e) => setFormData({ ...formData, legalForm: e.target.value })}
                      className="bg-secondary/50 border-border"
                      placeholder="Ex: SARL, SA..."
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email contact</Label>
                    <Input
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="bg-secondary/50 border-border"
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone</Label>
                    <Input
                      value={formData.phone || ""}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="bg-secondary/50 border-border"
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>NIF</Label>
                    <Input
                      value={formData.nif}
                      onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                      className="bg-secondary/50 border-border"
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>RCCM</Label>
                    <Input
                      value={formData.rccm}
                      onChange={(e) => setFormData({ ...formData, rccm: e.target.value })}
                      className="bg-secondary/50 border-border"
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="col-span-full space-y-2">
                    <Label htmlFor="company-address">Adresse complète</Label>
                    <Input
                        id="company-address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="bg-secondary/50 border-border"
                        disabled={!isAdmin}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-0">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Préférences de Facturation</CardTitle>
              </div>
              <CardDescription>Fiscalité gabonaise et numérotation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>TVA (%)</Label>
                  <Input
                    type="number"
                    value={formData.tvaRate}
                    className="bg-secondary/50 border-border"
                    disabled
                  />
                  <p className="text-[10px] text-muted-foreground italic">Fixé à 18% (DGI)</p>
                </div>
                <div className="space-y-2">
                  <Label>CSS (%)</Label>
                  <Input
                    type="number"
                    value={formData.cssRate}
                    onChange={(e) => setFormData({ ...formData, cssRate: parseFloat(e.target.value) || 0 })}
                    className="bg-secondary/50 border-border"
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label>TPS (%)</Label>
                  <Input
                    type="number"
                    value={formData.tpsRate}
                    onChange={(e) => setFormData({ ...formData, tpsRate: parseFloat(e.target.value) || 0 })}
                    className="bg-secondary/50 border-border"
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code Entreprise (Ex: GM)</Label>
                  <Input
                    value={formData.companyCode}
                    onChange={(e) => setFormData({ ...formData, companyCode: e.target.value })}
                    className="bg-secondary/50 border-border"
                    disabled={!isAdmin}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              </div>

              <div className="space-y-2">
                <Label htmlFor="mentions-legales">Notes & Mentions Légales par défaut</Label>
                <Textarea
                  id="mentions-legales"
                  value={formData.mentionsLegales || ""}
                  onChange={(e) => setFormData({ ...formData, mentionsLegales: e.target.value })}
                  placeholder="Ex: Conditions générales de vente..."
                  className="bg-secondary/50 border-border min-h-[120px]"
                  disabled={!isAdmin}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank" className="mt-0">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Coordonnées Bancaires</CardTitle>
              </div>
              <CardDescription>Pour les règlements par virement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Banque</Label>
                  <Input
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="bg-secondary/50 border-border"
                    placeholder="Ex: BGFI Bank, BICIG..."
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Agence</Label>
                  <Input
                    value={formData.bankAgency}
                    onChange={(e) => setFormData({ ...formData, bankAgency: e.target.value })}
                    className="bg-secondary/50 border-border"
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label>N° de compte</Label>
                  <Input
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="bg-secondary/50 border-border font-mono"
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code SWIFT / BIC</Label>
                  <Input
                    value={formData.swiftCode}
                    onChange={(e) => setFormData({ ...formData, swiftCode: e.target.value })}
                    className="bg-secondary/50 border-border font-mono"
                    disabled={!isAdmin}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>IBAN</Label>
                  <Input
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                    className="bg-secondary/50 border-border font-mono"
                    disabled={!isAdmin}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
