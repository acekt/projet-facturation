"use client";

import { setupApp } from "@/app/actions/setup.actions";
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
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
  Loader2,
  Percent,
  Landmark,
  Shield,
  Upload,
  X
} from "lucide-react"

export default function SetupClient() {
  const router = useRouter()
  const [step, setStep] = React.useState<1 | 2>(1)
  const [companyTab, setCompanyTab] = React.useState<'identity' | 'billing' | 'bank' | 'security'>('identity')
  const [loading, setLoading] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)

  // ══════════════════════════════════════════════════════════════════════
  // ÉTAPE 1 : ENTREPRISE (Correspondant à tous les onglets des paramètres)
  // ══════════════════════════════════════════════════════════════════════
  // 1. Identité
  const [companyName, setCompanyName] = React.useState('')
  const [legalForm, setLegalForm] = React.useState('SARL')
  const [nif, setNif] = React.useState('')
  const [rccm, setRccm] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [companyPhone, setCompanyPhone] = React.useState('')
  const [companyEmail, setCompanyEmail] = React.useState('')
  const [logo, setLogo] = React.useState<string | null>(null)

  // 2. Facturation & Fiscalité (Gabon / CEMAC)
  const [companyCode, setCompanyCode] = React.useState('FAC')
  const [invoicePrefix, setInvoicePrefix] = React.useState('FAC-')
  const [quotePrefix, setQuotePrefix] = React.useState('DEV-')
  const [tvaRate, setTvaRate] = React.useState<number>(18.0)
  const [cssRate, setCssRate] = React.useState<number>(1.0)
  const [tpsRate, setTpsRate] = React.useState<number>(9.5)
  const [mentionsLegales, setMentionsLegales] = React.useState('')

  // 3. Coordonnées Bancaires
  const [bankName, setBankName] = React.useState('')
  const [bankAgency, setBankAgency] = React.useState('')
  const [accountNumber, setAccountNumber] = React.useState('')
  const [swiftCode, setSwiftCode] = React.useState('')
  const [iban, setIban] = React.useState('')

  // 4. Sécurité
  const [sessionTimeout, setSessionTimeout] = React.useState<number>(60)

  // ══════════════════════════════════════════════════════════════════════
  // ÉTAPE 2 : ADMINISTRATEUR LOCAL
  // ══════════════════════════════════════════════════════════════════════
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [phone, setPhone] = React.useState('')

  const setUser = useStore((state) => state.setUser)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Auto-génération intelligente du code court d'entreprise lors de la saisie
  const handleCompanyNameChange = (val: string) => {
    setCompanyName(val)
    if (!companyCode || companyCode === 'FAC') {
      const clean = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3)
      if (clean.length >= 2) {
        setCompanyCode(clean)
        setInvoicePrefix(`${clean}-`)
        setQuotePrefix(`DEV-${clean}-`)
      }
    }
  }

  // Gestion de l'upload du logo en base64
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Le logo est trop lourd (max. 2 Mo)")
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setLogo(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Validation Étape 1 (Entreprise)
  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim()) {
      toast.error("Le nom de l'entreprise est obligatoire")
      setCompanyTab('identity')
      return
    }
    if (!legalForm.trim()) {
      toast.error("La forme juridique est obligatoire (ex: SARL, SA, SAS...)")
      setCompanyTab('identity')
      return
    }
    if (!companyCode.trim()) {
      toast.error("Le code entreprise est requis (ex: FAC)")
      setCompanyTab('billing')
      return
    }
    if (!invoicePrefix.trim()) {
      toast.error("Le préfixe de facture est requis")
      setCompanyTab('billing')
      return
    }
    setStep(2)
  }

  // Validation finale Étape 2 (Admin) et soumission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Le nom de l'administrateur est requis")
      return
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error("Veuillez saisir une adresse email administrateur valide")
      return
    }
    if (password.length < 6) {
      toast.error("Le mot de passe doit comporter au moins 6 caractères")
      return
    }

    setLoading(true)
    try {
      const res = await setupApp({
        // Admin
        name,
        email,
        password,
        phone: phone || null,

        // Entreprise - Identité
        companyName,
        legalForm,
        nif: nif || null,
        rccm: rccm || null,
        address: address || null,
        companyPhone: companyPhone || null,
        companyEmail: companyEmail || null,
        logo: logo || null,

        // Facturation & Fiscalité
        companyCode,
        invoicePrefix,
        quotePrefix,
        tvaRate,
        cssRate,
        tpsRate,
        mentionsLegales: mentionsLegales || null,

        // Banque
        bankName: bankName || null,
        bankAgency: bankAgency || null,
        accountNumber: accountNumber || null,
        swiftCode: swiftCode || null,
        iban: iban || null,

        // Sécurité
        sessionTimeout,
      })

      if (res.success) {
        toast.success("Initialisation de l'entreprise et du compte réussie !")
        if (res.data?.user) {
          setUser(res.data.user)
        }
        await new Promise(resolve => setTimeout(resolve, 300))
        router.push('/')
        router.refresh()
      } else {
        toast.error(res.error || "Erreur lors de l'initialisation")
      }
    } catch {
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
        <div className="hidden md:flex flex-col relative w-[42%] lg:w-[40%] h-full bg-primary overflow-hidden p-10 justify-between">
          
          <div className="relative z-10">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-10">
              <div className="relative w-12 h-12 bg-white rounded-lg shadow-md overflow-hidden">
                <Image src="/logo.png" alt="Logo Facturier" fill className="object-contain p-1" />
              </div>
              <span className="text-primary-foreground font-bold text-xl tracking-tight">Facturier</span>
            </div>
            
            {/* Titre et Explication dynamique */}
            <div className="mt-8 space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary-foreground/10 text-primary-foreground border border-primary-foreground/20">
                <span>Configuration Initiale</span>
              </div>
              <h2 className="text-3xl font-bold text-primary-foreground leading-tight tracking-tight">
                {step === 1 ? "Configurez votre entreprise." : "Créez l'administrateur."}
              </h2>
              <p className="text-primary-foreground/80 text-[15px] leading-relaxed max-w-md font-medium">
                {step === 1 
                  ? "Renseignez l'identité légale de votre structure, les taux fiscaux et les coordonnées de facturation." 
                  : "Définissez le compte maître qui gérera l'ensemble du logiciel et les accès collaborateurs."}
              </p>
            </div>

            {/* Timeline des étapes inversée : 1. Entreprise -> 2. Administrateur */}
            <div className="space-y-4 pt-10">
              {/* Étape 1 : Profil & Paramètres Entreprise */}
              <div 
                onClick={() => setStep(1)} 
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                  step === 1 
                    ? 'bg-primary-foreground/10 border-primary-foreground/20 shadow-sm' 
                    : 'bg-transparent border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  step === 1 
                    ? 'bg-primary-foreground text-primary font-bold shadow-md' 
                    : 'bg-primary-foreground/20 text-primary-foreground font-bold'
                }`}>
                  {step === 2 ? <CheckCircle2 className="w-5 h-5 text-emerald-300" /> : '1'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-primary-foreground">Profil de l'Entreprise</h4>
                  <p className="text-xs text-primary-foreground/70 font-medium">Identité légale, fiscalité et banque</p>
                </div>
              </div>

              {/* Étape 2 : Compte Administrateur */}
              <div 
                onClick={() => { if (companyName.trim() && legalForm.trim()) setStep(2) }} 
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  step === 2 
                    ? 'bg-primary-foreground/10 border-primary-foreground/20 shadow-sm' 
                    : 'bg-transparent border-transparent opacity-60 hover:opacity-100 cursor-pointer'
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
                  <h4 className="text-sm font-bold text-primary-foreground">Compte Administrateur</h4>
                  <p className="text-xs text-primary-foreground/70 font-medium">Identifiants et accès principaux</p>
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
        {/* COLONNE DROITE : FORMULAIRE EN 2 ÉTAPES */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col p-6 sm:p-10 md:p-12 relative bg-background overflow-y-auto">
          
          <div className="w-full max-w-2xl mx-auto space-y-6 my-auto">
            
            {/* Barre de navigation haute */}
            <div className="flex items-center justify-between border-b pb-4">
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                <span>Retour à la connexion</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                  Étape {step} sur 2 : {step === 1 ? "Entreprise" : "Administrateur"}
                </span>
              </div>
            </div>

            {step === 1 ? (
              /* ========================================================= */
              /* ÉTAPE 1 : PROFIL & PARAMÈTRES DE L'ENTREPRISE             */
              /* ========================================================= */
              <form onSubmit={handleNextStep} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                      Votre Entreprise
                    </h1>
                    <p className="text-xs text-muted-foreground font-medium">
                      Ces informations figureront sur vos factures, devis et reçus fiscaux.
                    </p>
                  </div>
                </div>

                {/* Onglets de configuration de l'entreprise */}
                <Tabs value={companyTab} onValueChange={(v) => setCompanyTab(v as any)} className="w-full">
                  <TabsList className="grid grid-cols-4 bg-secondary p-1 rounded-xl mb-4 text-xs font-semibold">
                    <TabsTrigger value="identity" className="rounded-lg gap-1.5 text-xs">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Identité</span>
                    </TabsTrigger>
                    <TabsTrigger value="billing" className="rounded-lg gap-1.5 text-xs">
                      <Percent className="w-3.5 h-3.5" />
                      <span>Facturation</span>
                    </TabsTrigger>
                    <TabsTrigger value="bank" className="rounded-lg gap-1.5 text-xs">
                      <Landmark className="w-3.5 h-3.5" />
                      <span>Banque</span>
                    </TabsTrigger>
                    <TabsTrigger value="security" className="rounded-lg gap-1.5 text-xs">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Sécurité</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* ──────────────── Sous-Onglet 1 : Identité Légale ──────────────── */}
                  <TabsContent value="identity" className="space-y-4 mt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                      
                      {/* Upload Logo */}
                      <div className="space-y-2">
                        <Label className="text-xs">Logo (Optionnel)</Label>
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="relative aspect-square w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center p-2 text-center cursor-pointer bg-secondary/30 overflow-hidden"
                        >
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleLogoUpload} 
                            accept="image/png,image/jpeg,image/svg+xml" 
                            className="hidden" 
                          />
                          {logo ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                              <img src={logo} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setLogo(null); }}
                                className="absolute -top-1 -right-1 bg-destructive text-white p-1 rounded-full shadow-md"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                              <Upload className="w-5 h-5 text-primary" />
                              <span className="text-[11px] font-semibold">Ajouter logo</span>
                              <span className="text-[9px] text-muted-foreground">PNG, JPG (max 2 Mo)</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Champs Nom et Forme Juridique */}
                      <div className="sm:col-span-2 space-y-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="company-name" className="text-xs font-semibold">
                            Nom commercial de l'entreprise *
                          </Label>
                          <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="company-name"
                              type="text"
                              value={companyName}
                              onChange={(e) => handleCompanyNameChange(e.target.value)}
                              placeholder="ex: Facturier Gabon S.A."
                              className="pl-10 bg-secondary border-border text-foreground"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="legal-form" className="text-xs font-semibold">
                            Forme Juridique *
                          </Label>
                          <Input
                            id="legal-form"
                            type="text"
                            value={legalForm}
                            onChange={(e) => setLegalForm(e.target.value)}
                            placeholder="SARL, SA, SAS, SUARL, Entreprise Individuelle..."
                            className="bg-secondary border-border text-foreground"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="company-nif" className="text-xs">NIF (Fiscalité)</Label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="company-nif"
                            type="text"
                            value={nif}
                            onChange={(e) => setNif(e.target.value)}
                            placeholder="ex: NIF 123456 A"
                            className="pl-10 bg-secondary border-border text-foreground font-mono text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="company-rccm" className="text-xs">RCCM (Registre du commerce)</Label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="company-rccm"
                            type="text"
                            value={rccm}
                            onChange={(e) => setRccm(e.target.value)}
                            placeholder="ex: GA-LBV-2026-B12"
                            className="pl-10 bg-secondary border-border text-foreground font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="company-address" className="text-xs">Adresse complète / Siège social</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="company-address"
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Boulevard Triomphal, Libreville, Gabon"
                          className="pl-10 bg-secondary border-border text-foreground"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="company-phone" className="text-xs">Téléphone professionnel</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="company-phone"
                            type="tel"
                            value={companyPhone}
                            onChange={(e) => setCompanyPhone(e.target.value)}
                            placeholder="+241 01 70 00 00"
                            className="pl-10 bg-secondary border-border text-foreground"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="company-email" className="text-xs">Email contact professionnel</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="company-email"
                            type="email"
                            value={companyEmail}
                            onChange={(e) => setCompanyEmail(e.target.value)}
                            placeholder="contact@entreprise.ga"
                            className="pl-10 bg-secondary border-border text-foreground"
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* ──────────────── Sous-Onglet 2 : Facturation & Fiscalité ──────────────── */}
                  <TabsContent value="billing" className="space-y-4 mt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="company-code" className="text-xs font-semibold">Code Entreprise *</Label>
                        <Input
                          id="company-code"
                          type="text"
                          value={companyCode}
                          onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                          placeholder="ex: FAC"
                          className="bg-secondary border-border font-mono uppercase text-xs"
                          required
                        />
                        <span className="text-[10px] text-muted-foreground">Trigramme pour les pièces</span>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="invoice-prefix" className="text-xs font-semibold">Préfixe Factures *</Label>
                        <Input
                          id="invoice-prefix"
                          type="text"
                          value={invoicePrefix}
                          onChange={(e) => setInvoicePrefix(e.target.value)}
                          placeholder="ex: FAC-"
                          className="bg-secondary border-border font-mono text-xs"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="quote-prefix" className="text-xs font-semibold">Préfixe Devis *</Label>
                        <Input
                          id="quote-prefix"
                          type="text"
                          value={quotePrefix}
                          onChange={(e) => setQuotePrefix(e.target.value)}
                          placeholder="ex: DEV-"
                          className="bg-secondary border-border font-mono text-xs"
                          required
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-secondary/50 rounded-xl border border-border space-y-3">
                      <span className="text-xs font-bold text-foreground block">Fiscalité gabonaise par défaut (DGI)</span>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px]">TVA (%)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={tvaRate}
                            onChange={(e) => setTvaRate(parseFloat(e.target.value) || 0)}
                            className="bg-card border-border text-xs"
                          />
                          <span className="text-[10px] text-muted-foreground">Standard 18%</span>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">CSS (%)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={cssRate}
                            onChange={(e) => setCssRate(parseFloat(e.target.value) || 0)}
                            className="bg-card border-border text-xs"
                          />
                          <span className="text-[10px] text-muted-foreground">Solidarité 1%</span>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">TPS (%)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={tpsRate}
                            onChange={(e) => setTpsRate(parseFloat(e.target.value) || 0)}
                            className="bg-card border-border text-xs"
                          />
                          <span className="text-[10px] text-muted-foreground">Services 9.5%</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="mentions-legales" className="text-xs">Notes & Mentions Légales par défaut (bas de facture)</Label>
                      <Textarea
                        id="mentions-legales"
                        value={mentionsLegales}
                        onChange={(e) => setMentionsLegales(e.target.value)}
                        placeholder="Ex: Paiement à 30 jours. Aucun escompte accordé pour paiement anticipé..."
                        className="bg-secondary border-border min-h-[80px] text-xs"
                      />
                    </div>
                  </TabsContent>

                  {/* ──────────────── Sous-Onglet 3 : Coordonnées Bancaires ──────────────── */}
                  <TabsContent value="bank" className="space-y-4 mt-0">
                    <p className="text-xs text-muted-foreground">
                      Ces informations apparaîtront sur les factures pour permettre les virements bancaires de vos clients.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="bank-name" className="text-xs">Nom de la Banque</Label>
                        <Input
                          id="bank-name"
                          type="text"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder="ex: BGFI Bank Gabon, BICIG, UBA..."
                          className="bg-secondary border-border text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="bank-agency" className="text-xs">Agence</Label>
                        <Input
                          id="bank-agency"
                          type="text"
                          value={bankAgency}
                          onChange={(e) => setBankAgency(e.target.value)}
                          placeholder="ex: Agence Centrale Libreville"
                          className="bg-secondary border-border text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="bank-account" className="text-xs">Numéro de Compte</Label>
                        <Input
                          id="bank-account"
                          type="text"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          placeholder="ex: 40001 02000 12345678901 25"
                          className="bg-secondary border-border font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="bank-swift" className="text-xs">Code SWIFT / BIC</Label>
                        <Input
                          id="bank-swift"
                          type="text"
                          value={swiftCode}
                          onChange={(e) => setSwiftCode(e.target.value)}
                          placeholder="ex: BGFIGAXXX"
                          className="bg-secondary border-border font-mono uppercase text-xs"
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-1.5">
                        <Label htmlFor="bank-iban" className="text-xs">IBAN / RIB</Label>
                        <Input
                          id="bank-iban"
                          type="text"
                          value={iban}
                          onChange={(e) => setIban(e.target.value)}
                          placeholder="ex: GA21 4000 1020 0012 3456 7890 125"
                          className="bg-secondary border-border font-mono uppercase text-xs"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* ──────────────── Sous-Onglet 4 : Sécurité ──────────────── */}
                  <TabsContent value="security" className="space-y-4 mt-0">
                    <div className="p-4 bg-secondary/50 rounded-xl border border-border space-y-2">
                      <Label htmlFor="session-timeout" className="text-xs font-semibold">
                        Délai d'expiration de session d'inactivité (en minutes)
                      </Label>
                      <Input
                        id="session-timeout"
                        type="number"
                        min={5}
                        max={1440}
                        value={sessionTimeout}
                        onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 60)}
                        className="bg-card border-border text-xs max-w-xs"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        L'application se verrouillera automatiquement après cette durée d'inactivité pour protéger vos données comptables.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Bouton de passage à l'étape 2 */}
                <div className="pt-2">
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-semibold py-2.5 shadow-sm"
                  >
                    <span>Continuer vers le Compte Administrateur</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            ) : (
              /* ========================================================= */
              /* ÉTAPE 2 : CRÉATION DU COMPTE ADMINISTRATEUR LOCAL         */
              /* ========================================================= */
              <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <UserCheck className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                      Administrateur Principal
                    </h1>
                    <p className="text-xs text-muted-foreground font-medium">
                      Ce compte aura le contrôle total et les droits de gestion sur <strong className="text-foreground">{companyName || "votre entreprise"}</strong>.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-name" className="text-xs font-semibold">Nom complet *</Label>
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

                  <div className="space-y-1.5">
                    <Label htmlFor="admin-email" className="text-xs font-semibold">Adresse email de connexion *</Label>
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

                  <div className="space-y-1.5">
                    <Label htmlFor="admin-password" className="text-xs font-semibold">Mot de passe (min. 6 caractères) *</Label>
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

                  <div className="space-y-1.5">
                    <Label htmlFor="admin-phone" className="text-xs">Téléphone personnel (Optionnel)</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="admin-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+241 07 00 00 00"
                        className="pl-10 bg-secondary border-border text-foreground"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-secondary/50 rounded-xl border border-border flex items-start gap-2.5 text-xs text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    Vos identifiants seront hachés avec <strong>bcrypt</strong> et enregistrés dans votre base SQLite locale autonome.
                  </span>
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
                    <span>Retour à l'entreprise</span>
                  </Button>

                  <Button 
                    type="submit" 
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-semibold shadow-sm"
                    disabled={loading}
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Initialisation en cours...</>
                    ) : (
                      <>
                        <span>Terminer et Démarrer Facturier</span>
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
