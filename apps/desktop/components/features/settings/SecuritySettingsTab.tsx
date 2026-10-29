"use client"

import * as React from "react"
import { ShieldAlert } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@/lib/utils"
import type { Settings } from "@/lib/store"

interface SecuritySettingsTabProps {
  formData: Settings
  setFormData: React.Dispatch<React.SetStateAction<Settings>>
  errors: Record<string, string[]>
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
  isAdmin: boolean
}

export function SecuritySettingsTab({
  formData,
  setFormData,
  errors,
  setErrors,
  isAdmin,
}: SecuritySettingsTabProps) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Sécurité et Accès</CardTitle>
        </div>
        <CardDescription>Paramètres de session locale et de déconnexion automatique</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className={errors.sessionTimeout ? "text-destructive" : ""}>
              Expiration de session (en minutes) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              value={formData.sessionTimeout ?? 60}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, sessionTimeout: parseInt(e.target.value) || 60 }))
                setErrors((prev) => ({ ...prev, sessionTimeout: [] }))
              }}
              className={cn("bg-secondary/50 border-border tabular-nums", errors.sessionTimeout && "border-destructive focus-visible:ring-destructive")}
              disabled={!isAdmin}
              min={1}
            />
            {errors.sessionTimeout && <p className="text-[10px] text-destructive font-medium">{errors.sessionTimeout[0]}</p>}
            <p className="text-[10px] text-muted-foreground italic">Verrouillage automatique après inactivité</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

