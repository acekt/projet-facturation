"use client"

import * as React from "react"
import { Percent } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@/lib/utils"
import type { Settings } from "@/lib/store"

interface BillingSettingsTabProps {
  formData: Settings
  setFormData: React.Dispatch<React.SetStateAction<Settings>>
  errors: Record<string, string[]>
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
  isAdmin: boolean
}

export function BillingSettingsTab({
  formData,
  setFormData,
  errors,
  setErrors,
  isAdmin,
}: BillingSettingsTabProps) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Percent className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Préférences de Facturation</CardTitle>
        </div>
        <CardDescription>Fiscalité gabonaise (TVA, CSS, TPS) et règles de numérotation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className={errors.tvaRate ? "text-destructive" : ""}>
              TVA (%) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              value={formData.tvaRate ?? 0}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, tvaRate: parseFloat(e.target.value) || 0 }))
                setErrors((prev) => ({ ...prev, tvaRate: [] }))
              }}
              className={cn("bg-secondary/50 border-border tabular-nums", errors.tvaRate && "border-destructive focus-visible:ring-destructive")}
              disabled={!isAdmin}
            />
            {errors.tvaRate && <p className="text-[10px] text-destructive font-medium">{errors.tvaRate[0]}</p>}
            <p className="text-[10px] text-muted-foreground italic">Fixé légalement à 18% (DGI)</p>
          </div>
          <div className="space-y-2">
            <Label>CSS (%) <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              value={formData.cssRate ?? 0}
              onChange={(e) => setFormData((prev) => ({ ...prev, cssRate: parseFloat(e.target.value) || 0 }))}
              className="bg-secondary/50 border-border tabular-nums"
              disabled={!isAdmin}
            />
            <p className="text-[10px] text-muted-foreground italic">Contribution Spéciale de Solidarité (1%)</p>
          </div>
          <div className="space-y-2">
            <Label>TPS (%)</Label>
            <Input
              type="number"
              value={formData.tpsRate ?? 0}
              onChange={(e) => setFormData((prev) => ({ ...prev, tpsRate: parseFloat(e.target.value) || 0 }))}
              className="bg-secondary/50 border-border tabular-nums"
              disabled={!isAdmin}
            />
            <p className="text-[10px] text-muted-foreground italic">Taxe sur Prestations de Services (9.5%)</p>
          </div>
          <div className="space-y-2">
            <Label className={errors.companyCode ? "text-destructive" : ""}>
              Code Entreprise (Ex: GM) <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.companyCode || ""}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, companyCode: e.target.value }))
                setErrors((prev) => ({ ...prev, companyCode: [] }))
              }}
              className={cn("bg-secondary/50 border-border font-mono", errors.companyCode && "border-destructive focus-visible:ring-destructive")}
              disabled={!isAdmin}
            />
            {errors.companyCode && <p className="text-[10px] text-destructive font-medium">{errors.companyCode[0]}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className={errors.quotePrefix ? "text-destructive" : ""}>
              Préfixe des Devis (Ex: DEV) <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.quotePrefix || ""}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, quotePrefix: e.target.value }))
                setErrors((prev) => ({ ...prev, quotePrefix: [] }))
              }}
              className={cn("bg-secondary/50 border-border font-mono", errors.quotePrefix && "border-destructive focus-visible:ring-destructive")}
              disabled={!isAdmin}
            />
            {errors.quotePrefix && <p className="text-[10px] text-destructive mt-1 font-medium">{errors.quotePrefix[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label className={errors.invoicePrefix ? "text-destructive" : ""}>
              Préfixe des Factures (Ex: FAC) <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.invoicePrefix || ""}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, invoicePrefix: e.target.value }))
                setErrors((prev) => ({ ...prev, invoicePrefix: [] }))
              }}
              className={cn("bg-secondary/50 border-border font-mono", errors.invoicePrefix && "border-destructive focus-visible:ring-destructive")}
              disabled={!isAdmin}
            />
            {errors.invoicePrefix && <p className="text-[10px] text-destructive mt-1 font-medium">{errors.invoicePrefix[0]}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mentions-legales">Notes & Mentions Légales par défaut</Label>
          <Textarea
            id="mentions-legales"
            value={formData.mentionsLegales || ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, mentionsLegales: e.target.value }))}
            placeholder="Ex: Conditions de paiement à 30 jours, pénalités de retard..."
            className="bg-secondary/50 border-border min-h-[120px]"
            disabled={!isAdmin}
          />
        </div>
      </CardContent>
    </Card>
  )
}

