"use client"

import * as React from "react"
import { Landmark } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import type { Settings } from "@/lib/store"

interface BankSettingsTabProps {
  formData: Settings
  setFormData: React.Dispatch<React.SetStateAction<Settings>>
  isAdmin: boolean
}

export function BankSettingsTab({ formData, setFormData, isAdmin }: BankSettingsTabProps) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Coordonnées Bancaires</CardTitle>
        </div>
        <CardDescription>Mentions bancaires pour les règlements par virement (affichées en pied de page)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Banque</Label>
            <Input
              value={formData.bankName || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, bankName: e.target.value }))}
              className="bg-secondary/50 border-border"
              placeholder="Ex: BGFI Bank, BICIG, UGB..."
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-2">
            <Label>Agence</Label>
            <Input
              value={formData.bankAgency || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, bankAgency: e.target.value }))}
              className="bg-secondary/50 border-border"
              placeholder="Ex: Agence Principale Libreville"
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-2">
            <Label>N° de compte</Label>
            <Input
              value={formData.accountNumber || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, accountNumber: e.target.value }))}
              className="bg-secondary/50 border-border font-mono tabular-nums"
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-2">
            <Label>Code SWIFT / BIC</Label>
            <Input
              value={formData.swiftCode || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, swiftCode: e.target.value }))}
              className="bg-secondary/50 border-border font-mono"
              disabled={!isAdmin}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>IBAN / Clé RIB</Label>
            <Input
              value={formData.iban || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, iban: e.target.value }))}
              className="bg-secondary/50 border-border font-mono tabular-nums"
              disabled={!isAdmin}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

