"use client"

/**
 * LoginClient — Composant Client du formulaire de Connexion "Facturier"
 * ====================================================================
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from "@/lib/store"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ChevronRight, 
  CheckCircle2, 
  Star,
  Users,
  Sparkles,
  Loader2
} from "lucide-react"

export default function LoginClient() {
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const [showDemoOptions, setShowDemoOptions] = React.useState(false)
  
  const router = useRouter()
  const setUser = useStore((state) => state.setUser)
  const [isPending, startSubmitTransition] = React.useTransition()

  // Soumission du formulaire
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    startSubmitTransition(() => {
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      .then(res => res.json().then(data => ({ res, data })))
      .then(({ res, data }) => {
        if (res.ok) {
          toast.success("Connexion réussie. Bienvenue dans Facturier !")
          setUser(data.user)
          setTimeout(() => {
            router.push('/')
            router.refresh()
            setIsSubmitting(false)
          }, 250)
        } else {
          toast.error(data.error || "Identifiants invalides")
          setIsSubmitting(false)
        }
      })
      .catch(err => {
        toast.error("Impossible de joindre le serveur local")
        setIsSubmitting(false)
      })
    })
  }

  // Raccourci pour remplir les comptes de démo
  const fillDemoCredentials = (role: 'admin' | 'operator') => {
    if (role === 'admin') {
      setUsername('admin@facturier.ga')
      setPassword('admin123')
      toast.info("Identifiants Administrateur insérés")
    } else {
      setUsername('operateur@facturier.ga')
      setPassword('operateur123')
      toast.info("Identifiants Opérateur insérés")
    }
    setShowDemoOptions(false)
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100/60 dark:bg-[#030303] p-4 md:p-8 transition-colors duration-300">
      
      {/* Container Principal (Card Centrée) */}
      <div className="max-w-5xl w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[620px] transition-all duration-300">
        
        {/* ========================================================================= */}
        {/* COLONNE GAUCHE : BRANDING ET VALEURS */}
        {/* ========================================================================= */}
        <div className="md:col-span-5 bg-slate-100/60 dark:bg-zinc-900/50 border-r border-slate-200 dark:border-zinc-800 p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
          {/* Subtils effets de halo lumineux en arrière-plan */}
          <div className="absolute top-0 left-0 w-40 h-40 bg-primary/5 rounded-full filter blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-accent/5 rounded-full filter blur-3xl pointer-events-none" />

          {/* Logo & Branding */}
          <div className="flex items-center gap-2.5 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-md shadow-primary/20">
              <Star className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-zinc-50 tracking-tight text-lg block leading-none">FACTURIER</span>
              <span className="text-[9px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Gestion Gabonaise</span>
            </div>
          </div>

          {/* Proposition de Valeur */}
          <div className="my-10 md:my-0 space-y-6 relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-zinc-50 leading-tight tracking-tight">
              Gerez votre facturation avec <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">excellence</span>.
            </h2>
            <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
              La solution locale et conforme pour piloter vos devis, factures, règlements et avoirs en toute sérénité au Gabon.
            </p>

            {/* Liste des points forts */}
            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Conformité DGI locale</h4>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium">Calcul strict des taxes TVA, TPS et CSS</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Résilience 100% Hors-Ligne</h4>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium">Base SQLite locale ultra-rapide et sécurisée</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Suivi financier instantané</h4>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium">Tableaux de bord et état des paiements en temps réel</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Gauche */}
          <div className="text-xs text-slate-600 dark:text-zinc-400 relative z-10 pt-4 md:pt-0 font-medium">
            <p>© 2026 Facturier S.A. Tous droits réservés.</p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLONNE DROITE : FORMULAIRE DE CONNEXION */}
        {/* ========================================================================= */}
        <div className="md:col-span-7 bg-white dark:bg-zinc-950 p-8 md:p-12 flex flex-col justify-between transition-colors duration-300">
          
          {/* Formulaire et en-tête */}
          <div className="space-y-8 my-auto">
            {/* En-tête */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-50 tracking-tight">Bon retour parmi nous</h1>
              <p className="text-sm text-slate-600 dark:text-zinc-350 font-medium">Entrez vos identifiants pour accéder à votre espace de gestion.</p>
            </div>

            {/* Formulaire de saisie */}
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Identifiant */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-800 dark:text-zinc-200 font-medium">Identifiant ou Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-zinc-400" />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="nom@facturier.ga"
                    className="pl-10 h-11 bg-slate-50/50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 text-sm focus-visible:ring-primary focus-visible:ring-offset-0 text-slate-900 dark:text-zinc-50 placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                    required
                    disabled={isPending || isSubmitting}
                  />
                </div>
              </div>

              {/* Mot de passe */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-slate-800 dark:text-zinc-200 font-medium">Mot de passe</Label>
                  <button
                    type="button"
                    onClick={() => toast.info("Veuillez contacter votre administrateur système pour réinitialiser votre mot de passe.")}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-zinc-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-11 bg-slate-50/50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 text-sm focus-visible:ring-primary focus-visible:ring-offset-0 text-slate-900 dark:text-zinc-50 placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                    required
                    disabled={isPending || isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Bouton de Connexion */}
              <Button 
                type="submit" 
                className="w-full h-11 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-500 gap-2 shadow-lg shadow-blue-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isPending || isSubmitting}
              >
                {(isPending || isSubmitting) ? <Loader2 className="w-4 h-4 animate-spin" /> : "Se connecter"}
                {!(isPending || isSubmitting) && <ChevronRight className="w-4 h-4" />}
              </Button>
            </form>

            {/* Séparateur */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-zinc-800"></div>
              <span className="flex-shrink mx-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">ou</span>
              <div className="flex-grow border-t border-slate-200 dark:border-zinc-800"></div>
            </div>

            {/* Bouton de Démo et Options */}
            <div className="space-y-3">
              {!showDemoOptions ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDemoOptions(true)}
                  className="w-full h-11 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900 gap-2 font-bold"
                >
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                  Utiliser un compte de démonstration
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fillDemoCredentials('admin')}
                    className="h-10 text-xs font-bold gap-1.5"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500 shrink-0" />
                    Admin
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fillDemoCredentials('operator')}
                    className="h-10 text-xs font-bold gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    Opérateur
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowDemoOptions(false)}
                    className="col-span-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-zinc-450 dark:hover:text-zinc-200 pt-1"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Note de Sécurité */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 mt-8 pt-4 md:pt-0 border-t border-slate-100 dark:border-zinc-900 md:border-t-0 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-500 shrink-0" />
            <span>Connexion locale sécurisée • Chiffrement cryptographique</span>
          </div>
        </div>

      </div>
    </div>
  )
}
