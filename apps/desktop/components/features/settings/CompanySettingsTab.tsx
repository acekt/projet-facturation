"use client"

import * as React from "react"
import { Building2, CloudUpload, X, Mail, CheckCircle2, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Settings } from "@/lib/store"
import { testSmtpConnectionAction } from "@/app/actions/share.actions"

interface CompanySettingsTabProps {
  formData: Settings
  setFormData: React.Dispatch<React.SetStateAction<Settings>>
  errors: Record<string, string[]>
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
  isAdmin: boolean
}

export function CompanySettingsTab({
  formData,
  setFormData,
  errors,
  setErrors,
  isAdmin,
}: CompanySettingsTabProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [isTestingSmtp, setIsTestingSmtp] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const effectiveLogo = formData.logo || "/logo.png"

  const handleTestSmtp = async () => {
    if (!formData.smtpHost?.trim() || !formData.smtpUser?.trim() || !formData.smtpPass?.trim()) {
      toast.error("Veuillez renseigner l'hôte, l'identifiant et le mot de passe SMTP avant de tester.")
      return
    }
    setIsTestingSmtp(true)
    try {
      const res = await testSmtpConnectionAction({
        smtpHost: formData.smtpHost.trim(),
        smtpPort: Number(formData.smtpPort || 587),
        smtpUser: formData.smtpUser.trim(),
        smtpPass: formData.smtpPass,
        smtpSecure: Boolean(formData.smtpSecure),
      })
      if (res.success) {
        toast.success("Connexion SMTP vérifiée avec succès", {
          description: "Le serveur d'envoi d'emails est opérationnel.",
        })
      } else {
        toast.error("Échec du test SMTP", {
          description: res.error || "Vérifiez vos paramètres de serveur et d'authentification.",
        })
      }
    } catch (err) {
      toast.error("Erreur lors du test SMTP", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      })
    } finally {
      setIsTestingSmtp(false)
    }
  }

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
      setFormData((prev) => ({ ...prev, logo: reader.result as string }))
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* 1. Identité de l'entreprise */}
      <Card className="xl:col-span-7 bg-card border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Identité de l'entreprise</CardTitle>
          </div>
          <CardDescription>Informations légales et logo pour les devis et factures</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="space-y-3 w-full sm:w-56 shrink-0">
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
                  effectiveLogo && "border-solid border-primary/20 bg-white dark:bg-slate-950"
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

                {effectiveLogo ? (
                  <div className="group w-full h-full flex flex-col items-center justify-center gap-2 relative">
                    <img
                      src={effectiveLogo}
                      alt="Logo preview"
                      className="max-w-full max-h-[140px] object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none"
                      }}
                    />
                    {!formData.logo && (
                      <span className="text-[10px] text-muted-foreground font-medium bg-secondary/80 px-2 py-0.5 rounded">
                        Logo par défaut
                      </span>
                    )}
                    {isAdmin && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2 rounded-xl">
                        <CloudUpload className="w-7 h-7" />
                        <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white/20 backdrop-blur-sm">
                          {formData.logo ? "Remplacer le logo" : "Modifier le logo"}
                        </span>
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
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, logo: "" }))}
                  className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 mx-auto transition-colors font-bold uppercase tracking-tighter cursor-pointer"
                >
                  <X className="w-3 h-3" /> Supprimer le logo
                </button>
              )}
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              <div className="space-y-2">
                <Label htmlFor="company-name" className={errors.companyName ? "text-destructive" : ""}>
                  Nom Commercial <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="company-name"
                  value={formData.companyName || ""}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, companyName: e.target.value }))
                    setErrors((prev) => ({ ...prev, companyName: [] }))
                  }}
                  className={cn("bg-secondary/50 border-border", errors.companyName && "border-destructive focus-visible:ring-destructive")}
                  disabled={!isAdmin}
                />
                {errors.companyName && <p className="text-[10px] text-destructive mt-1 font-medium">{errors.companyName[0]}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal-form" className={errors.legalForm ? "text-destructive" : ""}>
                  Forme Juridique <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="legal-form"
                  value={formData.legalForm || ""}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, legalForm: e.target.value }))
                    setErrors((prev) => ({ ...prev, legalForm: [] }))
                  }}
                  className={cn("bg-secondary/50 border-border", errors.legalForm && "border-destructive focus-visible:ring-destructive")}
                  placeholder="Ex: SARL, SA..."
                  disabled={!isAdmin}
                />
                {errors.legalForm && <p className="text-[10px] text-destructive mt-1 font-medium">{errors.legalForm[0]}</p>}
              </div>
              <div className="space-y-2">
                <Label className={errors.email ? "text-destructive" : ""}>Email contact</Label>
                <Input
                  value={formData.email || ""}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                    setErrors((prev) => ({ ...prev, email: [] }))
                  }}
                  className={cn("bg-secondary/50 border-border", errors.email && "border-destructive focus-visible:ring-destructive")}
                  disabled={!isAdmin}
                />
                {errors.email && <p className="text-[10px] text-destructive mt-1 font-medium">{errors.email[0]}</p>}
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  value={formData.phone || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  className="bg-secondary/50 border-border"
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label>NIF</Label>
                <Input
                  value={formData.nif || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, nif: e.target.value }))}
                  className="bg-secondary/50 border-border"
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label>RCCM</Label>
                <Input
                  value={formData.rccm || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, rccm: e.target.value }))}
                  className="bg-secondary/50 border-border"
                  disabled={!isAdmin}
                />
              </div>
              <div className="col-span-full space-y-2">
                <Label htmlFor="company-address">Adresse complète</Label>
                <Input
                  id="company-address"
                  value={formData.address || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  className="bg-secondary/50 border-border"
                  disabled={!isAdmin}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Configuration d'envoi Email (SMTP) */}
      <Card className="xl:col-span-5 bg-card border-border shadow-sm">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Configuration d'envoi Email (SMTP)</CardTitle>
            </div>
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestSmtp}
                disabled={isTestingSmtp}
                className="gap-2 shrink-0 cursor-pointer"
              >
                {isTestingSmtp ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Tester la connexion
              </Button>
            )}
          </div>
          <CardDescription>
            Envoyez vos devis, factures et avoirs (avec PDF A4 joint automatiquement) directement depuis l'application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">Hôte SMTP</Label>
              <Input
                id="smtp-host"
                placeholder="Entrez l'hôte du serveur SMTP"
                value={formData.smtpHost || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, smtpHost: e.target.value }))}
                className="bg-secondary/50 border-border"
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">Port SMTP</Label>
              <Input
                id="smtp-port"
                type="number"
                min={1}
                max={65535}
                placeholder="Entrez le port SMTP"
                value={formData.smtpPort ?? 587}
                onChange={(e) => {
                  const port = Number(e.target.value) || 587
                  setFormData((prev) => ({
                    ...prev,
                    smtpPort: port,
                    smtpSecure: port === 465 ? true : prev.smtpSecure,
                  }))
                }}
                className="bg-secondary/50 border-border"
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-user">Identifiant / Adresse Email d'expédition</Label>
              <Input
                id="smtp-user"
                placeholder="Entrez l'adresse email d'expédition"
                value={formData.smtpUser || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, smtpUser: e.target.value }))}
                className="bg-secondary/50 border-border"
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-pass">Mot de passe SMTP / Mot de passe d'application</Label>
              <Input
                id="smtp-pass"
                type="password"
                placeholder="••••••••••••••••"
                value={formData.smtpPass || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, smtpPass: e.target.value }))}
                className="bg-secondary/50 border-border"
                disabled={!isAdmin}
              />
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="smtp-secure"
              checked={Boolean(formData.smtpSecure)}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  smtpSecure: Boolean(checked),
                  smtpPort: Boolean(checked) && prev.smtpPort === 587 ? 465 : prev.smtpPort,
                }))
              }
              disabled={!isAdmin}
            />
            <Label htmlFor="smtp-secure" className="text-xs text-muted-foreground font-normal cursor-pointer leading-tight">
              Connexion SSL/TLS directe (Port 465 recommandé pour SSL implicite, décochez pour STARTTLS sur le port 587)
            </Label>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
