"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  User,
  Shield,
  ShieldCheck,
  Mail,
  Phone,
  Key,
  Lock,
  Check,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import { userCreateSchema, userUpdateSchema } from "@/lib/validations"

interface UserEditorProps {
  onBack: () => void
  editingId?: string | null
}

export function UserEditor({ onBack, editingId }: UserEditorProps) {
  const { user: currentUser } = useStore()
  const [isLoading, setIsLoading] = React.useState(!!editingId)
  const [isSubmitting, startSubmitTransition] = React.useTransition()
  const [showPassword, setShowPassword] = React.useState(false)

  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    phone: "",
    role: "user" as "admin" | "user",
    password: "",
    force_password_change: true,
    is_active: true,
  })

  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (editingId) {
      fetchUser()
    }
  }, [editingId])

  const fetchUser = async () => {
    try {
      const res = await fetch(`/api/users`)
      if (res.ok) {
        const users = await res.json()
        const user = users.find((u: { id: string }) => u.id === editingId)
        if (user) {
          setFormData({
            name: user.name,
            email: user.email,
            phone: user.phone || "",
            role: user.role,
            password: "",
            force_password_change: user.force_password_change === 1,
            is_active: user.is_active === 1,
          })
        }
      }
    } catch (err) {
      toast.error("Erreur lors du chargement de l'utilisateur")
      onBack()
    } finally {
      setIsLoading(false)
    }
  }

  const validateForm = () => {
    const schema = editingId ? userUpdateSchema : userCreateSchema
    const dataToValidate = editingId 
      ? {
          ...formData,
          email: formData.email && formData.email !== "" ? formData.email : undefined,
        }
      : { ...formData, username: formData.email }
      
    const result = schema.safeParse(dataToValidate)
    
    if (!result.success) {
      const newErrors: Record<string, string> = {}
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message
        }
      })
      setErrors(newErrors)
      const firstError = result.error.errors[0]?.message || "Veuillez corriger les erreurs du formulaire"
      toast.error(firstError)
      return false
    }
    
    setErrors({})
    return true
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    startSubmitTransition(async () => {
      try {
        const url = editingId ? `/api/users/${editingId}` : '/api/users'
        const method = editingId ? 'PATCH' : 'POST'
        
        const payload = editingId 
          ? {
              name: formData.name,
              ...(formData.email && formData.email !== "" ? { email: formData.email, username: formData.email } : {}),
              phone: formData.phone || null,
              role: formData.role,
              ...(formData.password && formData.password !== "" ? { password: formData.password, force_password_change: true } : {}),
              is_active: formData.is_active,
            }
          : {
              username: formData.email,
              name: formData.name,
              email: formData.email,
              phone: formData.phone || null,
              role: formData.role,
              password: formData.password,
              force_password_change: formData.force_password_change,
              is_active: formData.is_active,
            }

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          toast.success(editingId ? "Utilisateur mis à jour" : "Utilisateur créé avec succès")
          onBack()
        } else {
          const data = await res.json()
          toast.error(data.error || "Erreur lors de l'opération")
        }
      } catch (err) {
        console.error('[UserEditor] handleSubmit error:', err)
        toast.error("Erreur réseau")
      }
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-6"
    >
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {editingId ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {editingId ? "Mettez à jour les informations du compte" : "Créez un nouvel accès pour un membre de votre équipe"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground font-semibold text-base flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Informations Personnelles
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet *</Label>
                  <Input
                    id="name"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Jean Dupont"
                    className="bg-secondary border-border text-foreground"
                  />
                  {errors.name && <p className="text-destructive text-sm font-medium">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jean@facturier.ga"
                    className="bg-secondary border-border text-foreground"
                    disabled={!!editingId}
                  />
                  {errors.email && <p className="text-destructive text-sm font-medium">{errors.email}</p>}
                  {editingId && !errors.email && (
                    <p className="text-xs text-muted-foreground">L'email ne peut pas être modifié</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+241 XX XX XX XX"
                    className="bg-secondary border-border text-foreground"
                  />
                  {errors.phone && <p className="text-destructive text-sm font-medium">{errors.phone}</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground font-semibold text-base flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Rôle & Droits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Rôle *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: "admin" | "user") => setFormData({ ...formData, role: value })}
                    disabled={editingId === currentUser?.id}
                  >
                    <SelectTrigger className="bg-secondary border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="user">
                        <div className="flex flex-col">
                          <span className="font-medium">Opérateur</span>
                          <span className="text-xs text-muted-foreground">Accès aux devis, factures, clients, services</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex flex-col">
                          <span className="font-medium">Administrateur</span>
                          <span className="text-xs text-muted-foreground">Gestion utilisateurs, paramètres, audit</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.role && <p className="text-destructive text-sm font-medium mt-1">{errors.role}</p>}
                  {editingId === currentUser?.id && !errors.role && (
                    <p className="text-xs text-muted-foreground">Vous ne pouvez pas modifier votre propre rôle</p>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Statut du compte</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Un compte inactif ne peut pas se connecter
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    disabled={editingId === currentUser?.id}
                  />
                </div>
                {editingId === currentUser?.id && (
                  <p className="text-xs text-muted-foreground">Vous ne pouvez pas désactiver votre propre compte</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground font-semibold text-base flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Sécurité
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">
                    Mot de passe {editingId ? "(optionnel)" : "*"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password || ""}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingId ? "Laisser vide pour ne pas modifier" : "Minimum 8 caractères"}
                      className="bg-secondary border-border text-foreground pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <Lock className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                    </Button>
                  </div>
                  {errors.password && <p className="text-destructive text-sm font-medium">{errors.password}</p>}
                  {editingId && !errors.password && (
                    <p className="text-xs text-muted-foreground">
                      Ne renseignez un nouveau mot de passe que si vous souhaitez le réinitialiser
                    </p>
                  )}
                </div>

                {!editingId && (
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Forcer le changement au premier login</Label>
                      <p className="text-[10px] text-muted-foreground">
                        L'utilisateur devra définir son propre mot de passe à la première connexion
                      </p>
                    </div>
                    <Switch
                      checked={formData.force_password_change}
                      onCheckedChange={(checked) => setFormData({ ...formData, force_password_change: checked })}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-card border-border sticky top-24">
              <CardHeader>
                <CardTitle className="text-foreground font-semibold text-base">Résumé</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Nom:</span>
                    <span className="font-medium text-foreground">{formData.name || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium text-foreground">{formData.email || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Rôle:</span>
                    <span className="font-medium text-foreground">
                      {formData.role === 'admin' ? 'Administrateur' : 'Opérateur'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Statut:</span>
                    <span className={`font-medium ${formData.is_active ? "text-emerald-600" : "text-gray-600"}`}>
                      {formData.is_active ? "Actif" : "Inactif"}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Enregistrement..." : editingId ? "Enregistrer les modifications" : "Créer l'utilisateur"}
                  </Button>
                </div>

                {editingId && (
                  <div className="pt-2">
                    <p className="text-[10px] text-muted-foreground text-center">
                      Dernière modification: {new Date().toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </motion.div>
  )
}
