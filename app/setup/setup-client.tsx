"use client"

import { setupApp } from "@/app/actions/setup.actions"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import Image from "next/image"
import { 
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
  Loader2
} from "lucide-react"

export default function SetupClient() {
  const router = useRouter()
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
      const res = await setupApp({
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
      })

      if (res.success) {
        toast.success("Initialisation de Facturier réussie !")
        if (res.data?.user) {
          setUser(res.data.user)
        }
        await new Promise(resolve => setTimeout(resolve, 300))
        router.push('/')
        router.refresh()
      } else {
        toast.error(res.error || "Erreur lors de l'initialisation")
      }
    } catch (err) {
      toast.error("Impossible de joindre le serveur local")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-background transition-colors duration-300">
      <div className="w-full h-full flex flex-col md:flex-row">
        
        {/* ========================================================================= */}
        {/* COLONNE GAUCHE (ILLUSTRATION & TIMELINE) */}
        {/* ========================================================================= */}
        <div className="hidden md:flex flex-col relative w-[45%] h-full bg-primary overflow-hidden p-10 justify-between">
          
          <div className="relative z-10">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-12">
              <div className="relative w-12 h-12 bg-white rounded-lg shadow-md overflow-hidden">
                <Image src="/logo.png" alt="Logo Facturier" fill className="object-contain p-1" />
              </div>
              <span className="text-primary-foreground font-bold text-xl tracking-tight">Facturier</span>
            </div>
            
            {/* Titre et Explication */}
            <div className="mt-12 space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary-foreground/10 text-primary-foreground border border-primary-foreground/20">
                <span>Configuration Initiale</span>
              </div>
              <h2 className="text-3xl font-bold text-primary-foreground leading-tight tracking-tight">
                Initialisez votre espace sécurisé.
              </h2>
              <p className="text-primary-foreground/80 text-[15px] leading-relaxed max-w-md font-medium">
                Configurez le compte administrateur principal ainsi que l'identité fiscale de votre entreprise au Gabon.
              </p>
            </div>

            {/* Timeline des étapes */}
            <div className="space-y-4 pt-12">
              {/* Step 1 */}
              <div 
                onClick={() => setStep(1)} 
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                  step === 1 
                    ? 'bg-primary-foreground/10 border-primary-foreground/20 shadow-sm' 
                    : 'bg-transparent border-transparent opacity-50 hover:opacity-100'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  step === 1 
                    ? 'bg-primary-foreground text-primary font-bold shadow-md' 
                    : 'bg-primary-foreground/20 text-primary-foreground font-bold'
                }`}>
                  {step === 2 ? <CheckCircle2 className="w-5 h-5" /> : '1'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-primary-foreground">Compte Administrateur</h4>
                  <p className="text-xs text-primary-foreground/70 font-medium">Identifiants et accès principaux</p>
                </div>
              </div>

              {/* Step 2 */}
              <div 
                onClick={() => { if (name && email && password.length >= 6) setStep(2) }} 
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  step === 2 
                    ? 'bg-primary-foreground/10 border-primary-foreground/20 shadow-sm' 
                    : 'bg-transparent border-transparent opacity-50 hover:opacity-100 cursor-pointer'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                  step === 2 
                    ? 'bg-primary-foreground text-primary shadow-md' 
                    : 'bg-primary-foreground/20 text-primary-foreground'
                }`}>
                  2
                </div>
                <div>
                  <h4 className="text-sm font-bold text-primary-foreground">Profil de l'Entreprise</h4>
                  <p className="text-xs text-primary-foreground/70 font-medium">NIF, RCCM et coordonnées légales</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Gauche */}
          <div className="flex items-center gap-2 text-xs text-primary-foreground/60 relative z-10 font-medium pt-4">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Base SQLite locale 100% autonome et sécurisée</span>
          </div>

          {/* Décoration d'arrière-plan abstraite */}
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-foreground/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary-foreground/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />
        </div>

        {/* ========================================================================= */}
        {/* COLONNE DROITE (BLANCHE) : FORMULAIRE */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col justify-center items-center p-8 sm:p-12 md:p-16 relative bg-background overflow-y-auto">
          
          <div className="w-full max-w-[420px] space-y-10 my-auto">
            
            {step === 1 ? (
              /* ========================================================= */
              /* ÉTAPE 1 : ADMINISTRATEUR PRINCIPAL                        */
              /* ========================================================= */
              <form onSubmit={handleNextStep} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                
                {/* En-tête du formulaire */}
                <div className="text-center space-y-2 mb-8">
                  <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center ring-4 ring-background shadow-sm">
                      <UserCheck className="w-8 h-8 text-primary" />
                    </div>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                    Administrateur
                  </h1>
                  <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                    Créez le compte qui aura le contrôle total de Facturier.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-name">Nom complet *</Label>
                    <Input
                      id="admin-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="ex: Jean-Paul MBOUMBA"
                      className="bg-secondary border-border text-foreground"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Adresse email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="admin-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@facturier.ga"
                        className="pl-10 bg-secondary border-border text-foreground"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Mot de passe (min. 6 caractères) *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="admin-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-10 pr-10 bg-secondary border-border text-foreground"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-phone">Téléphone (Optionnel)</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="admin-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+241 01 23 45 67"
                        className="pl-10 bg-secondary border-border text-foreground"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                  >
                    <span>Continuer vers le Profil Entreprise</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            ) : (
              /* ========================================================= */
              /* ÉTAPE 2 : INFORMATIONS DE L'ENTREPRISE                    */
              /* ========================================================= */
              <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                
                {/* En-tête du formulaire */}
                <div className="text-center space-y-2 mb-8">
                  <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center ring-4 ring-background shadow-sm">
                      <Building2 className="w-8 h-8 text-primary" />
                    </div>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                    Votre Entreprise
                  </h1>
                  <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                    Ces informations figureront sur vos factures.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Nom de l'entreprise *</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="company-name"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="ex: Facturier S.A."
                        className="pl-10 bg-secondary border-border text-foreground"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-nif">NIF</Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="company-nif"
                          type="text"
                          value={nif}
                          onChange={(e) => setNif(e.target.value)}
                          placeholder="NIF 123456"
                          className="pl-10 bg-secondary border-border text-foreground"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-rccm">RCCM</Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="company-rccm"
                          type="text"
                          value={rccm}
                          onChange={(e) => setRccm(e.target.value)}
                          placeholder="GA-LBV-2026-B12"
                          className="pl-10 bg-secondary border-border text-foreground"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company-address">Adresse</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="company-address"
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Quartier Louis, Libreville"
                        className="pl-10 bg-secondary border-border text-foreground"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-phone">Téléphone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="company-phone"
                          type="tel"
                          value={companyPhone}
                          onChange={(e) => setCompanyPhone(e.target.value)}
                          placeholder="+241 01 00 00 00"
                          className="pl-10 bg-secondary border-border text-foreground"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-email">Email contact</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="company-email"
                          type="email"
                          value={companyEmail}
                          onChange={(e) => setCompanyEmail(e.target.value)}
                          placeholder="contact@facturier.ga"
                          className="pl-10 bg-secondary border-border text-foreground"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={loading}
                    className="gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Retour</span>
                  </Button>

                  <Button 
                    type="submit" 
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Création...</>
                    ) : (
                      <>
                        <span>Terminer</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}
