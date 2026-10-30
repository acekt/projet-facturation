"use client"

import * as React from "react"
import { User, Mail, ShieldCheck, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"

interface UserSummaryCardProps {
  name: string
  email: string
  role: "admin" | "user"
  isActive: boolean
  isSubmitting: boolean
  isEditing: boolean
}

export function UserSummaryCard({
  name,
  email,
  role,
  isActive,
  isSubmitting,
  isEditing,
}: UserSummaryCardProps) {
  return (
    <Card className="bg-card border-border sticky top-6">
      <CardHeader>
        <CardTitle className="text-foreground font-semibold text-base">Récapitulatif</CardTitle>
        <CardDescription>Aperçu des informations utilisateur</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Nom:</span>
            <span className="font-medium text-foreground">{name || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Email:</span>
            <span className="font-medium text-foreground">{email || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Rôle:</span>
            <span className="font-medium text-foreground">
              {role === "admin" ? "Administrateur" : "Opérateur"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Statut:</span>
            <span className={`font-medium ${isActive ? "text-emerald-600" : "text-gray-600"}`}>
              {isActive ? "Actif" : "Inactif"}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Enregistrement..."
              : isEditing
                ? "Enregistrer les modifications"
                : "Créer l'utilisateur"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

