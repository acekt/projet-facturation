"use client"

import * as React from "react"
import { Lock, Eye, EyeOff, ShieldAlert, CheckCircle2, LogOut, Loader2, KeyRound } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Button } from "@workspace/ui/components/button"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { changeOwnPassword, logoutUser } from "@/app/actions/auth.actions"
import { supabaseSession } from "@/lib/auth/supabaseSession"
import { useStore } from "@/lib/store"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/utils/action-error"

interface ForcePasswordChangeDialogProps {
  open: boolean
  isMandatory?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
}

export function ForcePasswordChangeDialog({
  open,
  isMandatory = false,
  onOpenChange,
  onSuccess,
}: ForcePasswordChangeDialogProps) {
  const user = useStore((state) => state.user)
  const setUser = useStore((state) => state.setUser)
  const updateUserInStore = useStore((state) => state.updateUser)

  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [showCurrent, setShowCurrent] = React.useState(false)
  const [showNew, setShowNew] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)

  const hasMinLength = newPassword.length >= 8
  const hasLowercase = /[a-z]/.test(newPassword)
  const hasUppercase = /[A-Z]/.test(newPassword)
  const hasDigit = /\d/.test(newPassword)
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword
  const hasCurrentPassword = isMandatory || currentPassword.trim().length > 0
  const isPasswordValid = hasMinLength && hasLowercase && hasUppercase && hasDigit && passwordsMatch && hasCurrentPassword

  const resetForm = React.useCallback(() => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setError(null)
  }, [])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await supabaseSession.logout()
      await logoutUser()
    } catch (e) {
      console.warn("[ForcePasswordChangeDialog] Logout error:", e)
    }
    setUser(null)
    window.location.href = "/login"
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setError(null)

    if (!hasMinLength || !hasLowercase || !hasUppercase || !hasDigit) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("La confirmation du mot de passe ne correspond pas.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await changeOwnPassword({
        currentPassword: currentPassword.trim() ? currentPassword : undefined,
        newPassword,
      })

      if (!res.success) {
        setError(res.error || "Impossible de mettre à jour le mot de passe.")
        setIsSubmitting(false)
        return
      }

      // Synchronisation best-effort avec Supabase Auth si une session Cloud est active
      try {
        if (supabaseSession.isAuthenticated) {
          await supabaseSession.client.auth.updateUser({ password: newPassword })
        }
      } catch (cloudErr) {
        console.warn("[ForcePasswordChangeDialog] Mise à jour Cloud différée:", cloudErr)
      }

      if (user) {
        setUser({
          ...user,
          force_password_change: 0,
        })
        updateUserInStore(user.id, { force_password_change: 0 })
      }

      resetForm()
      toast.success("Votre mot de passe a été mis à jour avec succès.")
      onSuccess?.()
      if (!isMandatory) {
        onOpenChange?.(false)
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erreur inattendue lors de la mise à jour du mot de passe."))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isMandatory) return
        if (!nextOpen) resetForm()
        onOpenChange?.(nextOpen)
      }}
    >
      <DialogContent
        className="bg-card border-border sm:max-w-md"
        onInteractOutside={(e) => {
          if (isMandatory) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (isMandatory) e.preventDefault()
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-foreground text-lg">
                {isMandatory ? "Changement de mot de passe requis" : "Modifier mon mot de passe"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {isMandatory
                  ? "Mesure de sécurité obligatoire pour votre première connexion"
                  : "Mettez à jour vos identifiants personnels"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isMandatory && (
          <Alert className="bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/50">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-xs leading-relaxed font-medium">
              Vous utilisez actuellement un mot de passe temporaire attribué par votre administrateur.
              Veuillez définir un nouveau mot de passe personnel pour accéder à Facturier.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="py-2.5">
            <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isMandatory && (
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Mot de passe actuel</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-secondary/50 border-border pr-10"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="new-password">
              Nouveau mot de passe <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 caractères"
                className="bg-secondary/50 border-border pr-10"
                required
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">
              Confirmer le nouveau mot de passe <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répétez le mot de passe"
                className="bg-secondary/50 border-border pr-10"
                required
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Critères de sécurité en temps réel */}
          <div className="rounded-xl bg-secondary/40 border border-border p-3 space-y-1.5 text-xs">
            <p className="font-semibold text-foreground text-[11px] uppercase tracking-wider mb-1">
              Exigences de sécurité
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <span className={hasMinLength ? "text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium" : "text-muted-foreground flex items-center gap-1.5"}>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> 8 caractères min.
              </span>
              <span className={hasUppercase ? "text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium" : "text-muted-foreground flex items-center gap-1.5"}>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> 1 majuscule (A-Z)
              </span>
              <span className={hasLowercase ? "text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium" : "text-muted-foreground flex items-center gap-1.5"}>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> 1 minuscule (a-z)
              </span>
              <span className={hasDigit ? "text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium" : "text-muted-foreground flex items-center gap-1.5"}>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> 1 chiffre (0-9)
              </span>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2">
            {isMandatory ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleLogout}
                disabled={isSubmitting || isLoggingOut}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
              >
                <LogOut className="w-4 h-4" />
                {isLoggingOut ? "Déconnexion..." : "Se déconnecter"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange?.(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !isPasswordValid}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Valider le nouveau mot de passe
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
