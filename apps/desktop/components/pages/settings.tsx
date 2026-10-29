"use client"

import * as React from "react"
import { Save, ShieldAlert } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { useStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { toast } from "sonner"
import { updateSettings } from "@/app/actions/settings.actions"
import { UpdateManager } from "@/components/features/settings/UpdateManager"
import { CompanySettingsTab } from "@/components/features/settings/CompanySettingsTab"
import { BillingSettingsTab } from "@/components/features/settings/BillingSettingsTab"
import { BankSettingsTab } from "@/components/features/settings/BankSettingsTab"
import { SecuritySettingsTab } from "@/components/features/settings/SecuritySettingsTab"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"

export function SettingsPage() {
  const { settings, setSettings, user, isDataLoaded } = useStore(
    useShallow((state) => ({
      settings: state.settings,
      setSettings: state.setSettings,
      user: state.user,
      isDataLoaded: state.isDataLoaded,
    }))
  )
  const isAdmin = user?.role === "admin"

  const [formData, setFormData] = React.useState(settings)
  const [activeTab, setActiveTab] = React.useState("company")
  const [errors, setErrors] = React.useState<Record<string, string[]>>({})
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    setFormData({
      ...settings,
      tvaRate: settings.tvaRate ?? 18,
      cssRate: settings.cssRate ?? 1,
      tpsRate: settings.tpsRate ?? 9.5,
      sessionTimeout: settings.sessionTimeout ?? 60,
    })
    setErrors({})
  }, [settings])

  const handleSave = async () => {
    if (!isAdmin || isSaving) return
    setIsSaving(true)
    try {
      // Exclure les champs non reconnus par le schéma Zod (ex: 'id')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...payload } = formData as typeof formData & { id?: number }
      const response = await updateSettings(payload)

      if (!response.success) {
        if (response.details) {
          const e = response.details
          setErrors(e)

          // Basculer automatiquement vers le premier onglet en erreur
          if (e.companyName || e.legalForm || e.email || e.phone || e.nif || e.rccm || e.address || e.logo) {
            setActiveTab("company")
          } else if (e.tvaRate || e.cssRate || e.tpsRate || e.companyCode || e.quotePrefix || e.invoicePrefix || e.mentionsLegales) {
            setActiveTab("billing")
          } else if (e.bankName || e.bankAgency || e.accountNumber || e.swiftCode || e.iban) {
            setActiveTab("bank")
          } else if (e.sessionTimeout) {
            setActiveTab("security")
          }

          throw new Error("Veuillez corriger les erreurs signalées sur les onglets")
        }
        throw new Error(response.error)
      }

      setSettings({ ...settings, ...response.data })
      setErrors({})
      toast.success("Paramètres enregistrés avec succès (Ctrl+S)")
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(`Erreur : ${msg}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Raccourci ergonomique Ctrl+S / Cmd+S (Loi de Fitts)
  useKeyboardShortcuts({
    onSave: handleSave,
    enabled: isAdmin,
  })

  if (!isDataLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Chargement des paramètres...</p>
        </div>
      </div>
    )
  }

  const hasCompanyErrors = !!(errors.companyName || errors.legalForm || errors.email || errors.phone || errors.nif || errors.rccm || errors.address || errors.logo)
  const hasBillingErrors = !!(errors.tvaRate || errors.cssRate || errors.tpsRate || errors.companyCode || errors.quotePrefix || errors.invoicePrefix || errors.mentionsLegales)
  const hasBankErrors = !!(errors.bankName || errors.bankAgency || errors.accountNumber || errors.swiftCode || errors.iban)
  const hasSecurityErrors = !!errors.sessionTimeout

  return (
    <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-6 max-w-4xl">
      {!isAdmin && (
        <Alert variant="default" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50 mb-6">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="font-medium">
            Vous êtes en mode lecture seule (Opérateur). Seul un Administrateur peut modifier ces paramètres.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Paramètres</h1>
          <p className="text-muted-foreground mt-1">Configurez votre entreprise et vos préférences de facturation</p>
        </div>
        {isAdmin ? (
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 h-11 px-6 bg-primary hover:bg-primary-hover text-white shadow-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Enregistrement..." : "Enregistrer (Ctrl+S)"}
          </Button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50">
            <ShieldAlert className="w-4 h-4" />
            <span className="text-sm font-medium">Lecture seule (Opérateur)</span>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-secondary p-1 rounded-xl mb-6 flex-wrap">
          <TabsTrigger value="company" className="rounded-lg px-6 relative cursor-pointer">
            Entreprise
            {hasCompanyErrors && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive animate-pulse" />}
          </TabsTrigger>
          <TabsTrigger value="billing" className="rounded-lg px-6 relative cursor-pointer">
            Facturation
            {hasBillingErrors && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive animate-pulse" />}
          </TabsTrigger>
          <TabsTrigger value="bank" className="rounded-lg px-6 relative cursor-pointer">
            Banque
            {hasBankErrors && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive animate-pulse" />}
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg px-6 relative cursor-pointer">
            Sécurité
            {hasSecurityErrors && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive animate-pulse" />}
          </TabsTrigger>
          <TabsTrigger value="system" className="rounded-lg px-6 relative cursor-pointer">
            Mises à jour
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-0">
          <CompanySettingsTab
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            setErrors={setErrors}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="billing" className="mt-0">
          <BillingSettingsTab
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            setErrors={setErrors}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="bank" className="mt-0">
          <BankSettingsTab
            formData={formData}
            setFormData={setFormData}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="security" className="mt-0">
          <SecuritySettingsTab
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            setErrors={setErrors}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="system" className="mt-0">
          <UpdateManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
