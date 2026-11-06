"use client"

import * as React from "react"
import { Save, ShieldAlert } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { PageHeader } from "@/components/features/common/PageHeader"
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
      smtpHost: settings.smtpHost ?? "",
      smtpPort: settings.smtpPort ?? 587,
      smtpUser: settings.smtpUser ?? "",
      smtpPass: settings.smtpPass ?? "",
      smtpSecure: Boolean(settings.smtpSecure),
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
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* En-tête fixe en haut */}
        <div className="shrink-0 pb-4 border-b border-border space-y-4">
          {!isAdmin && (
            <Alert variant="default" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="font-medium">
                Vous êtes en mode lecture seule (Opérateur). Seul un Administrateur peut modifier ces paramètres.
              </AlertDescription>
            </Alert>
          )}

          <PageHeader
            title="Paramètres"
            description="Configurez votre entreprise et vos préférences de facturation"
            actions={
              isAdmin ? (
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-2 h-10 px-5 bg-primary hover:bg-primary-hover text-white shadow-sm cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Enregistrement..." : "Enregistrer (Ctrl+S)"}
                </Button>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50">
                  <ShieldAlert className="w-4 h-4" />
                  <span className="text-xs font-medium">Lecture seule (Opérateur)</span>
                </div>
              )
            }
          />

          <TabsList className="bg-secondary p-1 rounded-xl flex-wrap">
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
        </div>

        {/* Zone de contenu scrollable sur toute la largeur */}
        <div className="flex-1 overflow-y-auto min-h-0 pt-6 pr-2 pb-6">
          <TabsContent value="company" className="mt-0 outline-none">
            <CompanySettingsTab
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              setErrors={setErrors}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="billing" className="mt-0 outline-none">
            <BillingSettingsTab
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              setErrors={setErrors}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="bank" className="mt-0 outline-none">
            <BankSettingsTab
              formData={formData}
              setFormData={setFormData}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="security" className="mt-0 outline-none">
            <SecuritySettingsTab
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              setErrors={setErrors}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="system" className="mt-0 outline-none">
            <UpdateManager />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
