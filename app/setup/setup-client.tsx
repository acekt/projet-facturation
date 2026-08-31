"use client"

/**
 * SetupClient — Formulaire d'initialisation en 2 étapes ("First-Run Setup")
 * =========================================================================
 *
 * UX/UI :
 *  - Étape 1 : Informations de l'Administrateur (Nom, Email, Mot de passe, Téléphone)
 *  - Étape 2 : Informations de l'Entreprise (Nom, NIF, RCCM, Adresse, Téléphone, Email)
 *  - Charte SaaS Facturier avec carte centrée, dégradés subtils, et validation interactive.
 */

import * as React from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import { 
  Star, 
  ShieldCheck, 
  UserCheck, 
  Building2, 
  Mail, 
  Lock, 
  Phone, 
  MapPin, 
  FileText, 
  Eye, 
  EyeOff, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2,
  Sparkles
} from "lucide-react"

export default function SetupClient() {
  const [step, setStep] = React.useState<1 | 2>(1)
  const [loading, setLoading] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)

  // Étape 1 : Admin
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [phone, setPhone] = React.useState('')

  // Étape 2 : Entreprise
  const [companyName, setCompanyName] = React.useState('')
  const [nif, setNif] = React.useState('')
  const [rccm, setRccm] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [companyPhone, setCompanyPhone] = React.useState('')
  const [companyEmail, setCompanyEmail] = React.useState('')

  const setUser = useStore((state) => state.setUser)

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Veuillez saisir votre nom complet")
      return
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error("Veuillez saisir une adresse email valide")
      return
    }
    if (password.length < 6) {
      toast.error("Le mot de passe doit comporter au moins 6 caractères")
      return
    }
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim()) {
      toast.error("Le nom de l'entreprise est requis")
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          phone,
          companyName,
          nif,
          rccm,
          address,
          companyPhone,
          companyEmail,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success("Initialisation de Facturier réussie !")
        if (data.user) {
          setUser(data.user)
        }
        await new Promise(resolve => setTimeout(resolve, 300))
        window.location.href = '/'
      } else {
        toast.error(data.error || "Erreur lors de l'initialisation")
      }
    } catch (err) {
      toast.error("Impossible de joindre le serveur local")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100/60 dark:bg-[#030303] p-4 md:p-8 transition-colors duration-300">
      
      <div className="max-w-5xl w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[660px] transition-all duration-300">
        
        {/* ========================================================================= */}
        {/* COLONNE GAUCHE : PROGRESSION & GUIDE D'ACCUEIL */}
        {/* ========================================================================= */}
        <div className="md:col-span-5 bg-slate-100/60 dark:bg-zinc-900/50 border-r border-slate-200 dark:border-zinc-800 p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-48 h-48 bg-primary/10 rounded-full filter blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full filter blur-3xl pointer-events-none" />

          {/* Logo */}
          <div className="flex items-center gap-2.5 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Star className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-zinc-50 tracking-tight text-lg block leading-none">FACTURIER</span>
              <span className="text-[9px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Configuration Initiale</span>
            </div>
          </div>

          {/* Indicateur d'étape */}
          <div className="my-10 md:my-0 space-y-8 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bienvenue dans l'installation</span>
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-zinc-50 leading-tight tracking-tight">
                Initialisez votre <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">espace sécurisé</span>.
              </h2>
              <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
                Configurez le compte administrateur principal ainsi que l'identité fiscale de votre entreprise au Gabon.
              </p>
            </div>

            {/* Steps Timeline */}
            <div className="space-y-4 pt-2">
              <div 
                onClick={() => setStep(1)} 
                className={`flex items-center gap-4 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  step === 1 
                    ? 'bg-white dark:bg-zinc-800/80 border-blue-500/40 shadow-sm' 
                    : 'bg-transparent border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  step === 1 
                    ? 'bg-blue-600 text-white font-bold' 
                    : 'bg-emerald-600 text-white font-bold'
                }`}>
                  {step === 2 ? <CheckCircle2 className="w-5 h-5" /> : '1'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Compte Administrateur</h4>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">Identifiants et accès principaux</p>
                </div>
              </div>

              <div 
                onClick={() => { if (name && email && password.length >= 6) setStep(2) }} 
                className={`flex items-center gap-4 p-3.5 rounded-2xl border transition-all ${
                  step === 2 
                    ? 'bg-white dark:bg-zinc-800/80 border-blue-500/40 shadow-sm' 
                    : 'bg-transparent border-transparent opacity-60'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                  step === 2 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                }`}>
                  2
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Profil de l'Entreprise</h4>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">NIF, RCCM et coordonnées légales</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Gauche */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 relative z-10 font-medium pt-4 md:pt-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-500 shrink-0" />
            <span>Base SQLite locale 100% autonome</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLONNE DROITE : FORMULAIRE EN 2 ÉTAPES */}
        {/* ========================================================================= */}
        <div className="md:col-span-7 bg-white dark:bg-zinc-950 p-8 md:p-12 flex flex-col justify-between transition-colors duration-300">
          
          {step === 1 ? (
            /* ========================================================= */
            /* ÉTAPE 1 : ADMINISTRATEUR PRINCIPAL                        */
            /* ========================================================= */
            <form onSubmit={handleNextStep} className="space-y-6 my-auto">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                  <UserCheck className="w-4 h-4" />
                  <span>Étape 1 sur 2</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50 tracking-tight">
                  Informations de l'Administrateur
                </h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  Cet utilisateur aura le contrôle total et les permissions d'administration sur Facturier.
                </p>
              </div>

              <div className="space-y-4">
                {/* Nom complet */}
                <div className="space-y-2">
                  <Label htmlFor="admin-name" className="text-slate-800 dark:text-zinc-200 font-medium">Nom complet *</Label>
                  <Input
                    id="admin-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ex: Jean-Paul MBOUMBA"
                    className="h-11 bg-slate-50/50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 text-sm focus-visible:ring-blue-600 text-slate-900 dark:text-zinc-50"
                    required
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="admin-email" className="text-slate-800 dark:text-zinc-200 font-medium">Adresse email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-zinc-400" />
                    <Input
                      id="admin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@lfacturier.ga"
                      className="pl-10 h-11 bg-slate-50/50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 text-sm focus-visible:ring-blue-600 text-slate-900 dark:text-zinc-50"
                      required
                    />
                  </div>
                </div>

                {/* Mot de passe */}
                <div className="space-y-2">
                  <Label htmlFor="admin-password" className="text-slate-800 dark:text-zinc-200 font-medium">Mot de passe (min. 6 caractères) *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-zinc-400" />
                    <Input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-10 pr-10 h-11 bg-slate-50/50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 text-sm focus-visible:ring-blue-600 text-slate-900 dark:text-zinc-50"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Téléphone Admin */}
                <div className="space-y-2">
                  <Label htmlFor="admin-phone" className="text-slate-800 dark:text-zinc-200 font-medium">Téléphone (Optionnel)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-zinc-400" />
                    <Input
                      id="admin-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+241 01 23 45 67"
                      className="pl-10 h-11 bg-slate-50/50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 text-sm focus-visible:ring-blue-600 text-slate-900 dark:text-zinc-50"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  type="submit" 
                  className="w-full h-11 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-lg shadow-blue-500/10 transition-all duration-200"
                >
                  <span>Étape suivante : Profil Entreprise</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </form>
          ) : (
            /* ========================================================= */
            /* ÉTAPE 2 : INFORMATIONS DE L'ENTREPRISE                    */
            /* ========================================================= */
            <form onSubmit={handleSubmit} className="space-y-6 my-auto animate-in fade-in slide-in-from-right-4 duration-250">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                  <Building2 className="w-4 h-4" />
                  <span>Étape 2 sur 2</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-50 tracking-tight">
                  Informations de l'Entreprise
                </h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  Ces informations figureront automatiquement en en-tête de vos devis, factures et avoirs officiels.
                </p>
              </div>

              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                {/* Nom de l'entreprise */}
                <div className="space-y-2">
                  <Label htmlFor="company-name" className="text-slate-800 dark:text-zinc-200 font-medium">Nom de l'entreprise *</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-zinc-400" />
                    <Input
                      id="company-name"
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="ex: Facturier S.A."
                      className="pl-10 h-11 bg-slate-50/50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 text-sm focus-visible:ring-blue-600 text-slate-900 dark:text-zinc-50"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* NIF */}
                  <div className="space-y-2">
                    <Label htmlFor="company-nif" className="text-slate-800 dark:text-zinc-200 font-medium">NIF</Label>
                    <div className="relative">
                      <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-zinc-400" />
                      <Input
                        id="company-nif"
                        type="text"
                        value={nif}
                        onChange={(e) => setNif(e.target.value)}
                        placeholder="NIF 123456"
                        className="pl-10 h-11 bg-slate-50/50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 text-sm focus-visible:ring-blue-600 text-slate-900 dark:text-zinc-50"
                      />
                    </div>
                  </div>

                  {/* RCCM */}
                  <div className="space-y-2">
                    <Label htmlFor="company-rccm" className="text-slate-800 dark:text-zinc-200 font-medium">RCCM</Label>
                    <div className="relative">
                      <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-zinc-400" />
                      <Input
                        id="company-rccm"
                        type="text"
                        value={rccm}
                        onChange={(e) => setRccm(e.target.value)}
                        placeholder="GA-LBV-01-2026-B12"
                        className="pl-10 h-11 bg-slate-50/50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 text-sm focus-visible:ring-blue-600 text-slate-900 dark:text-zinc-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Adresse */}
                <div className="space-y-2">
                  <Label htmlFor="company-address" className="text-slate-800 dark:text-zinc-200 font-medium">Adresse</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-500 dark:text-zinc-400" />
                    <Input
                      id="company-address"
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Quartier Louis, B.P. 1234, Libreville, Gabon"
                      className="pl-10 h-11 bg-slate-50/50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 text-sm focus-visible:ring-blue-600 text-slate-900 dark:text-zinc-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Téléphone entreprise */}
                  <div className="space-y-2">
                    <Label htmlFor="company-phone" className="text-slate-800 dark:text-zinc-200 font-medium">Téléphone Entreprise</Label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-zinc-400" />
                      <Input
                        id="company-phone"
                        type="tel"
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(e.target.value)}
                        placeholder="+241 01 00 00 00"
                        className="pl-10 h-11 bg-slate-50/50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 text-sm focus-visible:ring-blue-600 text-slate-900 dark:text-zinc-50"
                      />
                    </div>
                  </div>

                  {/* Email de contact */}
                  <div className="space-y-2">
                    <Label htmlFor="company-email" className="text-slate-800 dark:text-zinc-200 font-medium">Email de contact</Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-zinc-400" />
                      <Input
                        id="company-email"
                        type="email"
                        value={companyEmail}
                        onChange={(e) => setCompanyEmail(e.target.value)}
                        placeholder="contact@lfacturier.ga"
                        className="pl-10 h-11 bg-slate-50/50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 text-sm focus-visible:ring-blue-600 text-slate-900 dark:text-zinc-50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Boutons d'action Étape 2 */}
              <div className="flex items-center gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="h-11 px-5 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-bold gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Précédent</span>
                </Button>

                <Button 
                  type="submit" 
                  className="flex-1 h-11 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-lg shadow-blue-500/10 transition-all duration-200"
                  disabled={loading}
                >
                  {loading ? "Initialisation en cours..." : "Initialiser Facturier et se connecter"}
                  {!loading && <ChevronRight className="w-4 h-4" />}
                </Button>
              </div>
            </form>
          )}

          {/* Footer Droite */}
          <div className="flex justify-between items-center text-xs text-slate-500 dark:text-zinc-400 mt-8 pt-4 md:pt-0 border-t border-slate-100 dark:border-zinc-900 md:border-t-0 font-medium">
            <span>Données hébergées localement au Gabon</span>
            <span>Version 1.0.0</span>
          </div>
        </div>

      </div>
    </div>
  )
}
