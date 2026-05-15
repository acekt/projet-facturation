"use client"

import * as React from "react"
import { useStore } from "@/lib/store"
import { toast } from "sonner"
import { motion } from "framer-motion"
import {
  User,
  Building,
  CreditCard,
  Bell,
  Shield,
  ChevronRight,
  Save,
  Upload,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const settingsSections = [
  { id: "profile", label: "Profil", icon: User },
  { id: "company", label: "Entreprise", icon: Building },
  { id: "billing", label: "Facturation", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Securite", icon: Shield },
]

export function SettingsPage() {
  const { settings, updateSettings } = useStore()
  const [activeSection, setActiveSection] = React.useState("profile")
  const [formData, setFormData] = React.useState({ ...settings })

  const handleSave = () => {
    updateSettings(formData)
    toast.success("Parametres enregistres avec succes")
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Parametres</h1>
          <p className="text-muted-foreground mt-1">Configurez votre application et vos preferences</p>
        </div>
        <Button 
          onClick={handleSave}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg shadow-primary/20"
        >
          <Save className="w-4 h-4" />
          Enregistrer
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-1">
          {settingsSections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                activeSection === section.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <section.icon className={cn(
                "w-5 h-5",
                activeSection === section.id ? "text-primary" : ""
              )} />
              {section.label}
              <ChevronRight className={cn(
                "w-4 h-4 ml-auto transition-transform",
                activeSection === section.id && "rotate-90"
              )} />
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          {activeSection === "profile" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground font-semibold">Informations personnelles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-6">
                    <Avatar className="w-20 h-20 ring-4 ring-border">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-2xl font-bold">
                        JD
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Button variant="outline" className="gap-2">
                        <Upload className="w-4 h-4" />
                        Changer la photo
                      </Button>
                      <p className="text-muted-foreground text-sm mt-2">JPG, PNG ou GIF. Max 2MB.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm">Prenom</Label>
                      <Input
                        defaultValue="Jean"
                        className="bg-secondary border-border text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm">Nom</Label>
                      <Input
                        defaultValue="Dupont"
                        className="bg-secondary border-border text-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">Email</Label>
                    <Input
                      type="email"
                      defaultValue="jean.dupont@letoile.ga"
                      className="bg-secondary border-border text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">Telephone</Label>
                    <Input
                      defaultValue="+241 01 76 XX XX"
                      className="bg-secondary border-border text-foreground"
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "company" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground font-semibold">Informations de l&apos;entreprise</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">Raison sociale</Label>
                    <Input
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="bg-secondary border-border text-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm">NIF</Label>
                      <Input
                        value={formData.nif}
                        onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                        className="bg-secondary border-border text-foreground font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm">RCCM</Label>
                      <Input
                        value={formData.rccm}
                        onChange={(e) => setFormData({ ...formData, rccm: e.target.value })}
                        className="bg-secondary border-border text-foreground font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">Adresse</Label>
                    <Textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="bg-secondary border-border text-foreground min-h-[80px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm">Email de facturation</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="bg-secondary border-border text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm">Telephone</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="bg-secondary border-border text-foreground"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground font-semibold">Logo de l&apos;entreprise</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                      <span className="text-3xl font-bold text-primary-foreground">L&apos;E</span>
                    </div>
                    <div>
                      <Button variant="outline" className="gap-2">
                        <Upload className="w-4 h-4" />
                        Telecharger un logo
                      </Button>
                      <p className="text-muted-foreground text-sm mt-2">SVG, PNG ou JPG. 512x512px</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "billing" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground font-semibold">Parametres de facturation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm">Devise par defaut</Label>
                      <Select defaultValue="xaf">
                        <SelectTrigger className="bg-secondary border-border text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="xaf">XAF - Franc CFA</SelectItem>
                          <SelectItem value="eur">EUR - Euro</SelectItem>
                          <SelectItem value="usd">USD - Dollar US</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm">Taux de TVA (%)</Label>
                      <Input
                        type="number"
                        value={formData.tvaRate}
                        onChange={(e) => setFormData({ ...formData, tvaRate: parseFloat(e.target.value) || 0 })}
                        className="bg-secondary border-border text-foreground"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm">Taux CSS (%)</Label>
                      <Input
                        type="number"
                        value={formData.cssRate}
                        onChange={(e) => setFormData({ ...formData, cssRate: parseFloat(e.target.value) || 0 })}
                        className="bg-secondary border-border text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm">Delai de paiement (jours)</Label>
                      <Input
                        type="number"
                        value={formData.defaultDueDateDays}
                        onChange={(e) => setFormData({ ...formData, defaultDueDateDays: parseInt(e.target.value) || 0 })}
                        className="bg-secondary border-border text-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">Prefixe des factures</Label>
                    <Input
                      value={formData.invoicePrefix}
                      onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
                      className="bg-secondary border-border text-foreground font-mono"
                    />
                    <p className="text-muted-foreground text-xs">Exemple: {formData.invoicePrefix}-2024-0001</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">Mentions legales sur les factures</Label>
                    <Textarea
                      defaultValue="Reglement par virement bancaire, Airtel Money ou Moov Money. Delai de paiement: 30 jours."
                      className="bg-secondary border-border text-foreground min-h-[100px]"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground font-semibold">Coordonnees bancaires</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm">Banque</Label>
                      <Input
                        defaultValue="BGFI Bank"
                        className="bg-secondary border-border text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm">IBAN</Label>
                      <Input
                        defaultValue="GAXX XXXX XXXX XXXX XXXX"
                        className="bg-secondary border-border text-foreground font-mono"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "notifications" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground font-semibold">Preferences de notification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "Nouvelle facture payee", description: "Recevoir une notification quand un paiement est recu" },
                    { label: "Facture en retard", description: "Alertes pour les factures depassant la date d'echeance" },
                    { label: "Devis consulte", description: "Notification quand un client ouvre un devis" },
                    { label: "Rappels automatiques", description: "Envoyer des rappels aux clients pour les factures impayees" },
                    { label: "Rapport hebdomadaire", description: "Recevoir un resume de l'activite chaque semaine" },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="text-foreground font-medium">{item.label}</p>
                        <p className="text-muted-foreground text-sm">{item.description}</p>
                      </div>
                      <Switch defaultChecked={index < 3} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "security" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground font-semibold">Changer le mot de passe</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">Mot de passe actuel</Label>
                    <Input
                      type="password"
                      className="bg-secondary border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">Nouveau mot de passe</Label>
                    <Input
                      type="password"
                      className="bg-secondary border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">Confirmer le mot de passe</Label>
                    <Input
                      type="password"
                      className="bg-secondary border-border text-foreground"
                    />
                  </div>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Mettre a jour
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground font-semibold">Authentification a deux facteurs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                    <div>
                      <p className="text-foreground font-medium">Activer la 2FA</p>
                      <p className="text-muted-foreground text-sm">Ajouter une couche de securite supplementaire</p>
                    </div>
                    <Switch />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground font-semibold">Sessions actives</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-foreground font-medium">Session actuelle</p>
                        <p className="text-muted-foreground text-sm">Libreville, Gabon</p>
                      </div>
                    </div>
                    <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">Active</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
