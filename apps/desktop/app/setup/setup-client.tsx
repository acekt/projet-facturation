"use client";

import { setupApp } from "@/app/actions/setup.actions";
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
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
  X,
  Sparkles,
  Info
} from "lucide-react"
import { cn } from "@/lib/utils"

const POPULAR_LEGAL_FORMS = ['SARL', 'SA', 'SAS', 'SUARL', 'Entreprise Individuelle'] as const;

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

  // Upload du logo avec feedback
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Le fichier du logo est trop volumineux (max 2 Mo)")
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setLogo(reader.result as string)
      toast.success("Logo ajouté avec succès")
    }
    reader.readAsDataURL(file)
  }

  // Calcul dynamique de la force du mot de passe
  const passwordStrength = React.useMemo(() => {
    if (!password) return { score: 0, label: '', color: 'bg-muted' }
    let score = 0
    if (password.length >= 6) score++
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score++
    
    if (score <= 1) return { score: 1, label: 'Faible', color: 'bg-red-500' }
    if (score === 2) return { score: 2, label: 'Moyen', color: 'bg-amber-500' }
    if (score === 3) return { score: 3, label: 'Bon', color: 'bg-blue-500' }
    return { score: 4, label: 'Excellent', color: 'bg-emerald-500' }
  }, [password])

  // Validation Étape 1
  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim()) {
      toast.error("Veuillez renseigner le nom de votre entreprise")
      setCompanyTab('identity')
      return
    }
    if (!legalForm.trim()) {
      toast.error("Veuillez choisir la forme juridique")
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

  // Validation finale et soumission
  const handleSubmit = async (e: React.FormEvent) => {
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

    setLoading(true)
    try {
      const res = await setupApp({
        // Admin
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || null,

        // Entreprise
        companyName: companyName.trim(),
        legalForm: legalForm.trim(),
        nif: nif.trim() || null,
        rccm: rccm.trim() || null,
        address: address.trim() || null,
        companyPhone: companyPhone.trim() || null,
        companyEmail: companyEmail.trim() || null,
        logo: logo || null,

        // Facturation
        companyCode: companyCode.trim().toUpperCase(),
        invoicePrefix: invoicePrefix.trim(),
        quotePrefix: quotePrefix.trim(),
        tvaRate,
        cssRate,
        tpsRate,
        mentionsLegales: mentionsLegales.trim() || null,

        // Banque
        bankName: bankName.trim() || null,
        bankAgency: bankAgency.trim() || null,
        accountNumber: accountNumber.trim() || null,
        swiftCode: swiftCode.trim() || null,
        iban: iban.trim() || null,

        // Sécurité
        sessionTimeout,
      })

      if (res.success) {
        toast.success("Félicitations ! Votre espace Facturier est initialisé.")
        if (res.data?.user) {
          setUser(res.data.user)
        }
        await new Promise(resolve => setTimeout(resolve, 400))
        router.push('/')
        router.refresh()
      } else {
        toast.error(res.error || "Erreur lors de l'initialisation de l'application")
      }
    } catch {
      toast.error("Impossible d'initialiser la base locale")
    } finally {
      setLoading(false)
    }
  }

  // Calculs dynamiques pour le specimen d'aperçu de facture (Endowment Effect)
  const sampleHT = 500000
  const sampleTVA = Math.round(sampleHT * (tvaRate / 100))
  const sampleCSS = Math.round(sampleHT * (cssRate / 100))
  const sampleTTC = sampleHT + sampleTVA + sampleCSS

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' XAF'
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-background text-foreground transition-colors duration-300">
      <div className="w-full h-full flex flex-col md:flex-row">
        
        {/* ========================================================================= */}
        {/* COLONNE GAUCHE (PSYCHOLOGIE DU DESIGN : DOTATION, GRADIENT & RÉASSURANCE) */}
        {/* ========================================================================= */}
        <div className="hidden md:flex flex-col relative w-[44%] lg:w-[40%] xl:w-[38%] h-full bg-gradient-to-br from-primary via-primary/95 to-primary/85 overflow-y-auto p-6 lg:p-8 justify-between select-none border-r border-primary-foreground/10 text-primary-foreground">
          
          <div className="relative z-10 space-y-5">
            {/* Header Brand */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 bg-white rounded-xl shadow-md overflow-hidden flex items-center justify-center p-1.5 ring-2 ring-white/20">
                  <Image src="/logo.png" alt="Logo Facturier" fill className="object-contain p-1" />
                </div>
                <div>
                  <span className="font-extrabold text-xl tracking-tight text-white block leading-none">Facturier</span>
                  <span className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Gestion & Facturation CEMAC</span>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-300 bg-emerald-400/20 border border-emerald-400/30 px-3 py-1 rounded-full shadow-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Configuration Rapide
              </span>
            </div>

            {/* Titre dynamique valorisant */}
            <div className="space-y-1.5 pt-1">
              <h2 className="text-2xl lg:text-3xl font-extrabold text-white leading-tight tracking-tight">
                {step === 1 ? "Créez votre identité de facturation." : "Activez vos accès administrateur."}
              </h2>
              <p className="text-white/80 text-xs lg:text-sm leading-relaxed font-medium">
                {step === 1 
                  ? "Donnez un visage professionnel à vos devis et factures. Les mentions DGI Gabon sont déjà prêtes." 
                  : "Votre entreprise est prête ! Sécurisez le compte maître qui gérera vos clients et finances."}
              </p>
            </div>

            {/* Jauge psychologique de progression (Goal-Gradient Effect) */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3.5 space-y-2 shadow-inner">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Progression de l'installation
                </span>
                <span className="text-emerald-300 font-mono text-sm">{step === 1 ? "50%" : "100%"}</span>
              </div>
              <div className="w-full h-2.5 bg-black/20 rounded-full overflow-hidden p-0.5">
                <motion.div 
                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full shadow-sm"
                  initial={{ width: "50%" }}
                  animate={{ width: step === 1 ? "50%" : "100%" }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-white/75 font-medium">
                <span>{step === 1 ? "Étape 1 sur 2 : Entreprise" : "Étape 2 sur 2 : Super-Admin"}</span>
                <span className="text-emerald-300 font-semibold">{step === 1 ? "Moins d'1 min" : "Presque terminé !"}</span>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* APERÇU EN DIRECT DU DOCUMENT (PSYCHOLOGIE DE DOTATION / ENDOWMENT)  */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {step === 1 ? (
              <motion.div 
                key="preview-invoice"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-[11px] text-white/90 font-bold px-1">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-300" /> Aperçu direct de vos factures
                  </span>
                  <span className="text-[10px] text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/30 font-mono">
                    Conforme DGI Gabon
                  </span>
                </div>

                {/* Spécimen officiel d'en-tête de facture */}
                <div className="bg-white text-slate-900 rounded-2xl p-4 shadow-xl border border-white/40 space-y-3 relative overflow-hidden">
                  {/* Filigrane discret de sécurité */}
                  <div className="absolute -right-6 -bottom-6 text-[90px] font-black text-slate-100 select-none pointer-events-none">
                    FAC
                  </div>

                  {/* Header de la facture */}
                  <div className="flex items-start justify-between border-b border-slate-100 pb-3 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm shrink-0 overflow-hidden shadow-xs">
                        {logo ? (
                          <img src={logo} alt="Logo Entreprise" className="w-full h-full object-contain" />
                        ) : (
                          <span className="font-extrabold tracking-wider">
                            {(companyName || 'FAC').slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-900 leading-tight truncate max-w-[170px]">
                          {companyName.trim() || 'Votre Entreprise'}
                        </div>
                        <div className="text-[10px] font-bold text-primary flex items-center gap-1.5 mt-0.5">
                          <span className="bg-primary/10 px-1.5 py-0.2 rounded font-mono text-[9px]">{legalForm}</span>
                          <span>•</span>
                          <span className="text-slate-500 font-mono font-normal">
                            {nif.trim() ? `NIF: ${nif}` : 'NIF: 123456 A'}
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium truncate max-w-[170px] mt-0.5">
                          {address.trim() || 'Libreville, Gabon'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Original
                      </span>
                      <div className="text-xs font-mono font-bold text-slate-900 mt-1">
                        {invoicePrefix || 'FAC-'}2026-0001
                      </div>
                      <div className="text-[9px] text-slate-400">Date: 26/10/2026</div>
                    </div>
                  </div>

                  {/* Ligne d'article simulée */}
                  <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 space-y-1.5 relative z-10 text-[10px]">
                    <div className="flex justify-between font-bold text-slate-700 border-b border-slate-200/60 pb-1">
                      <span>Prestation / Article d'exemple</span>
                      <span className="font-mono">{formatMoney(sampleHT)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[9px]">
                      <span>TVA légale ({tvaRate}%)</span>
                      <span className="font-mono">{formatMoney(sampleTVA)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[9px]">
                      <span>CSS Solidarité ({cssRate}%)</span>
                      <span className="font-mono">{formatMoney(sampleCSS)}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-slate-900 pt-1 border-t border-slate-200/60 text-[11px]">
                      <span className="text-primary font-bold">Total Net à Payer</span>
                      <span className="font-mono text-emerald-600">{formatMoney(sampleTTC)}</span>
                    </div>
                  </div>

                  {/* Mention bancaire ou légale */}
                  <div className="text-[9px] text-slate-500 flex items-center justify-between pt-0.5 relative z-10 border-t border-slate-100">
                    <span className="truncate max-w-[200px]">
                      {bankName ? `Paiement : ${bankName}` : 'Paiement à réception ou virement'}
                    </span>
                    <span className="font-mono text-[8px] text-slate-400">Page 1/1</span>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Étape 2 : Badge Administrateur Maître */
              <motion.div 
                key="preview-admin"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-[11px] text-white/90 font-bold px-1">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" /> Badge d'Accès Maître
                  </span>
                  <span className="text-[10px] text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/30">
                    Actif
                  </span>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-900 font-extrabold flex items-center justify-center text-base shadow-md">
                      {name.trim() 
                        ? name.trim().split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() 
                        : 'AD'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white truncate">
                        {name.trim() || 'Votre Nom & Prénom'}
                      </div>
                      <div className="text-xs text-white/70 truncate">
                        {email.trim() || 'admin@votre-entreprise.ga'}
                      </div>
                      <div className="text-[10px] font-semibold text-emerald-300 mt-0.5 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Super-Administrateur Local
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 text-[11px] text-white/80 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-white/60">Entreprise affiliée :</span>
                      <span className="font-bold text-white truncate max-w-[150px]">{companyName || 'Facturier'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Droits :</span>
                      <span className="font-mono text-emerald-300">Contrôle Total (Root)</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </div>

          {/* Footer Gauche : Réassurance & Confiance Locale */}
          <div className="pt-4 border-t border-white/15 relative z-10 space-y-2">
            <div className="flex items-center gap-2 text-xs text-white/90 font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-300" />
              <span>Base SQLite locale sécurisée • Zéro dépendance cloud obligatoire</span>
            </div>
            <p className="text-[10px] text-white/60 font-medium leading-relaxed">
              Vos factures, clients et données comptables restent 100% sur votre ordinateur, même sans connexion Internet.
            </p>
          </div>

          {/* Décorations d'ambiance */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[350px] h-[350px] bg-black/15 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />
        </div>

        {/* ========================================================================= */}
        {/* COLONNE DROITE : FORMULAIRE BIENVEILLANT, FLUIDE & SANS FRICTION          */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col p-6 sm:p-8 md:p-10 lg:p-12 relative bg-background overflow-y-auto">
          
          <div className="w-full max-w-2xl mx-auto space-y-6 my-auto">
            
            {/* Barre haute : retour & indicateur d'étape */}
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
                <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                  Étape {step} sur 2 : {step === 1 ? "Entreprise" : "Administrateur"}
                </span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {step === 1 ? (
                /* ========================================================= */
                /* ÉTAPE 1 : PROFIL & PARAMÈTRES DE L'ENTREPRISE             */
                /* ========================================================= */
                <motion.form 
                  key="step-1"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleNextStep} 
                  className="space-y-6"
                >
                  
                  {/* Titre & Message d'accueil bienveillant */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                          Profil de votre Entreprise
                        </h1>
                        <p className="text-xs text-muted-foreground font-medium">
                          Renseignez le nom de votre structure. Tout est modifiable plus tard dans les Paramètres.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bannière de soulagement cognitif (Hick's Law) */}
                  <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground/80 leading-relaxed font-medium">
                      <strong>Rapide & Flexible :</strong> Seul le <em>nom commercial</em> est requis pour démarrer. Les taux fiscaux (TVA 18%, CSS 1%) et préfixes sont déjà configurés pour vous.
                    </p>
                  </div>

                  {/* Onglets ergonomiques */}
                  <Tabs value={companyTab} onValueChange={(v) => setCompanyTab(v as any)} className="w-full">
                    <TabsList className="grid grid-cols-4 bg-secondary/80 p-1 rounded-xl mb-4 text-xs font-semibold">
                      <TabsTrigger value="identity" className="rounded-lg gap-1.5 text-xs relative cursor-pointer">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Identité</span>
                        {companyName.trim() ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        ) : (
                          <span className="text-[10px] text-destructive font-bold">*</span>
                        )}
                      </TabsTrigger>

                      <TabsTrigger value="billing" className="rounded-lg gap-1.5 text-xs relative cursor-pointer">
                        <Percent className="w-3.5 h-3.5" />
                        <span>Facturation</span>
                        <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">DGI 18%</span>
                      </TabsTrigger>

                      <TabsTrigger value="bank" className="rounded-lg gap-1.5 text-xs relative cursor-pointer">
                        <Landmark className="w-3.5 h-3.5" />
                        <span>Banque</span>
                        <span className="text-[9px] font-normal text-muted-foreground">Opt.</span>
                      </TabsTrigger>

                      <TabsTrigger value="security" className="rounded-lg gap-1.5 text-xs relative cursor-pointer">
                        <Shield className="w-3.5 h-3.5" />
                        <span>Sécurité</span>
                        <span className="text-[9px] font-normal text-muted-foreground">Auto</span>
                      </TabsTrigger>
                    </TabsList>

                    {/* ──────────────── Sous-Onglet 1 : Identité Légale ──────────────── */}
                    <TabsContent value="identity" className="space-y-4 mt-0">
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                        {/* Upload Logo */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold flex items-center justify-between">
                            <span>Logo officiel</span>
                            <span className="text-[10px] text-muted-foreground">Optionnel</span>
                          </Label>
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="relative aspect-square w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-all flex flex-col items-center justify-center p-3 text-center cursor-pointer bg-secondary/30 hover:bg-secondary/50 overflow-hidden group shadow-xs"
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
                                  className="absolute top-1 right-1 bg-destructive text-white p-1 rounded-full shadow-md hover:scale-110 transition-transform cursor-pointer"
                                  title="Supprimer le logo"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1.5 text-muted-foreground group-hover:text-foreground transition-colors">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                  <Upload className="w-4 h-4" />
                                </div>
                                <span className="text-[11px] font-bold text-foreground">Ajouter logo</span>
                                <span className="text-[9px] text-muted-foreground">PNG, JPG (max 2 Mo)</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Nom commercial & Forme juridique */}
                        <div className="sm:col-span-2 space-y-3.5">
                          <div className="space-y-1.5">
                            <Label htmlFor="company-name" className="text-xs font-bold flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                Nom commercial de l'entreprise <span className="text-destructive">*</span>
                              </span>
                              <span className="text-[10px] text-primary font-semibold">Obligatoire</span>
                            </Label>
                            <div className="relative">
                              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                id="company-name"
                                type="text"
                                value={companyName}
                                onChange={(e) => handleCompanyNameChange(e.target.value)}
                                placeholder="ex: Kori Tech Gabon, Buroplus SARL..."
                                className="pl-10 bg-secondary/60 border-border text-foreground font-semibold text-sm h-11"
                                required
                                autoFocus
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              💡 C'est le nom qui apparaîtra en tête de toutes vos factures.
                            </span>
                          </div>

                          {/* Forme Juridique avec Sélection Rapide en 1 Clic */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="legal-form" className="text-xs font-bold">
                                Forme Juridique *
                              </Label>
                              <span className="text-[10px] text-muted-foreground">Cliquez pour choisir</span>
                            </div>
                            
                            {/* Boutons Pills 1-clic */}
                            <div className="flex flex-wrap gap-1.5">
                              {POPULAR_LEGAL_FORMS.map((form) => (
                                <button
                                  key={form}
                                  type="button"
                                  onClick={() => setLegalForm(form)}
                                  className={cn(
                                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1",
                                    legalForm === form 
                                      ? "bg-primary text-primary-foreground border-primary shadow-xs scale-102" 
                                      : "bg-secondary/50 text-muted-foreground border-border hover:text-foreground hover:bg-secondary"
                                  )}
                                >
                                  {legalForm === form && <CheckCircle2 className="w-3 h-3 text-primary-foreground shrink-0" />}
                                  <span>{form}</span>
                                </button>
                              ))}
                            </div>

                            <Input
                              id="legal-form"
                              type="text"
                              value={legalForm}
                              onChange={(e) => setLegalForm(e.target.value)}
                              placeholder="SARL, SA, SAS, SUARL, EI..."
                              className="bg-secondary/50 border-border text-foreground text-xs mt-1"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      {/* Fiscalité & Registre (Optionnels mais encouragés) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <div className="space-y-1.5">
                          <Label htmlFor="company-nif" className="text-xs font-medium flex items-center justify-between">
                            <span>NIF (Identifiant Fiscal)</span>
                            <span className="text-[10px] text-muted-foreground">Optionnel</span>
                          </Label>
                          <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="company-nif"
                              type="text"
                              value={nif}
                              onChange={(e) => setNif(e.target.value)}
                              placeholder="ex: 123456 A"
                              className="pl-10 bg-secondary/50 border-border text-foreground font-mono text-xs"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-1.5">
                          <Label htmlFor="company-rccm" className="text-xs font-medium flex items-center justify-between">
                            <span>RCCM (Registre du commerce)</span>
                            <span className="text-[10px] text-muted-foreground">Optionnel</span>
                          </Label>
                          <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="company-rccm"
                              type="text"
                              value={rccm}
                              onChange={(e) => setRccm(e.target.value)}
                              placeholder="ex: GA-LBV-2026-B12"
                              className="pl-10 bg-secondary/50 border-border text-foreground font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Adresse */}
                      <div className="space-y-1.5">
                        <Label htmlFor="company-address" className="text-xs font-medium flex items-center justify-between">
                          <span>Adresse physique / Siège social</span>
                          <span className="text-[10px] text-muted-foreground">Optionnel</span>
                        </Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="company-address"
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Boulevard Triomphal, Libreville, Gabon"
                            className="pl-10 bg-secondary/50 border-border text-foreground text-xs"
                          />
                        </div>
                      </div>

                      {/* Coordonnées de contact */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="company-phone" className="text-xs font-medium flex items-center justify-between">
                            <span>Téléphone professionnel</span>
                            <span className="text-[10px] text-muted-foreground">Optionnel</span>
                          </Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="company-phone"
                              type="tel"
                              value={companyPhone}
                              onChange={(e) => setCompanyPhone(e.target.value)}
                              placeholder="+241 01 70 00 00"
                              className="pl-10 bg-secondary/50 border-border text-foreground text-xs"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="company-email" className="text-xs font-medium flex items-center justify-between">
                            <span>Email professionnel</span>
                            <span className="text-[10px] text-muted-foreground">Optionnel</span>
                          </Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="company-email"
                              type="email"
                              value={companyEmail}
                              onChange={(e) => setCompanyEmail(e.target.value)}
                              placeholder="contact@entreprise.ga"
                              className="pl-10 bg-secondary/50 border-border text-foreground text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* ──────────────── Sous-Onglet 2 : Facturation & Fiscalité ──────────────── */}
                    <TabsContent value="billing" className="space-y-4 mt-0">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-xs text-foreground/80 leading-relaxed">
                          Ces valeurs sont <strong>préréglées et conformes</strong> à la législation fiscale du Gabon (TVA à 18% et CSS à 1%). Vous pouvez les conserver telles quelles ou les adapter.
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="company-code" className="text-xs font-semibold">Code Entreprise *</Label>
                          <Input
                            id="company-code"
                            type="text"
                            value={companyCode}
                            onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                            placeholder="ex: FAC"
                            className="bg-secondary/50 border-border font-mono uppercase text-xs"
                            required
                          />
                          <span className="text-[10px] text-muted-foreground">Sert à numéroter vos pièces</span>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="invoice-prefix" className="text-xs font-semibold">Préfixe Factures *</Label>
                          <Input
                            id="invoice-prefix"
                            type="text"
                            value={invoicePrefix}
                            onChange={(e) => setInvoicePrefix(e.target.value)}
                            placeholder="ex: FAC-"
                            className="bg-secondary/50 border-border font-mono text-xs"
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
                            className="bg-secondary/50 border-border font-mono text-xs"
                            required
                          />
                        </div>
                      </div>

                      <div className="p-3.5 bg-secondary/40 rounded-xl border border-border space-y-2.5">
                        <span className="text-xs font-bold text-foreground block">Taux légaux applicables</span>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium">TVA (%)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={tvaRate}
                              onChange={(e) => setTvaRate(parseFloat(e.target.value) || 0)}
                              className="bg-card border-border text-xs font-mono"
                            />
                            <span className="text-[10px] text-muted-foreground">Standard 18%</span>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium">CSS (%)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={cssRate}
                              onChange={(e) => setCssRate(parseFloat(e.target.value) || 0)}
                              className="bg-card border-border text-xs font-mono"
                            />
                            <span className="text-[10px] text-muted-foreground">Solidarité 1%</span>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium">TPS (%)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={tpsRate}
                              onChange={(e) => setTpsRate(parseFloat(e.target.value) || 0)}
                              className="bg-card border-border text-xs font-mono"
                            />
                            <span className="text-[10px] text-muted-foreground">Prestations 9.5%</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="mentions-legales" className="text-xs font-medium">Mentions Légales en pied de page</Label>
                        <Textarea
                          id="mentions-legales"
                          value={mentionsLegales}
                          onChange={(e) => setMentionsLegales(e.target.value)}
                          placeholder="Ex: Facture payable à réception. En cas de retard de paiement, une indemnité légale sera appliquée..."
                          className="bg-secondary/50 border-border min-h-[65px] text-xs"
                        />
                      </div>
                    </TabsContent>

                    {/* ──────────────── Sous-Onglet 3 : Coordonnées Bancaires ──────────────── */}
                    <TabsContent value="bank" className="space-y-4 mt-0">
                      <div className="bg-secondary/40 border border-border rounded-xl p-3 flex items-center gap-2.5 text-xs text-muted-foreground">
                        <Info className="w-4 h-4 text-primary shrink-0" />
                        <span>Facilitez le virement de vos clients en affichant votre RIB au pied de chaque document officiel.</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="bank-name" className="text-xs font-medium">Établissement Bancaire</Label>
                          <Input
                            id="bank-name"
                            type="text"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            placeholder="ex: BGFI Bank, BICIG, UBA, Orabank..."
                            className="bg-secondary/50 border-border text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="bank-agency" className="text-xs font-medium">Agence</Label>
                          <Input
                            id="bank-agency"
                            type="text"
                            value={bankAgency}
                            onChange={(e) => setBankAgency(e.target.value)}
                            placeholder="ex: Agence Principale Libreville"
                            className="bg-secondary/50 border-border text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="bank-account" className="text-xs font-medium">Numéro de Compte</Label>
                          <Input
                            id="bank-account"
                            type="text"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            placeholder="ex: 40001 02000 12345678901 25"
                            className="bg-secondary/50 border-border font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="bank-swift" className="text-xs font-medium">Code SWIFT / BIC</Label>
                          <Input
                            id="bank-swift"
                            type="text"
                            value={swiftCode}
                            onChange={(e) => setSwiftCode(e.target.value)}
                            placeholder="ex: BGFIGAXXX"
                            className="bg-secondary/50 border-border font-mono uppercase text-xs"
                          />
                        </div>
                        <div className="sm:col-span-2 space-y-1.5">
                          <Label htmlFor="bank-iban" className="text-xs font-medium">IBAN / Clé RIB</Label>
                          <Input
                            id="bank-iban"
                            type="text"
                            value={iban}
                            onChange={(e) => setIban(e.target.value)}
                            placeholder="ex: GA21 4000 1020 0012 3456 7890 125"
                            className="bg-secondary/50 border-border font-mono uppercase text-xs"
                          />
                        </div>
                      </div>
                    </TabsContent>

                    {/* ──────────────── Sous-Onglet 4 : Sécurité ──────────────── */}
                    <TabsContent value="security" className="space-y-4 mt-0">
                      <div className="p-4 bg-secondary/40 rounded-xl border border-border space-y-2">
                        <Label htmlFor="session-timeout" className="text-xs font-semibold">
                          Délai de verrouillage automatique (en minutes)
                        </Label>
                        <Input
                          id="session-timeout"
                          type="number"
                          min={5}
                          max={1440}
                          value={sessionTimeout}
                          onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 60)}
                          className="bg-card border-border text-xs font-mono max-w-xs"
                        />
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Pour protéger vos données financières en cas d'absence, l'application se verrouillera automatiquement après ce temps d'inactivité.
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Bouton d'action principal valorisant */}
                  <div className="pt-2">
                    <Button 
                      type="submit" 
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-extrabold py-3.5 shadow-md hover:shadow-lg transition-all cursor-pointer text-sm h-12 rounded-xl"
                    >
                      <span>Continuer vers le Compte Administrateur</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <p className="text-center text-[11px] text-muted-foreground mt-2 font-medium">
                      Étape 1/2 • Vos données restent enregistrées localement
                    </p>
                  </div>
                </motion.form>
              ) : (
                /* ========================================================= */
                /* ÉTAPE 2 : CRÉATION DU COMPTE ADMINISTRATEUR LOCAL         */
                /* ========================================================= */
                <motion.form 
                  key="step-2"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleSubmit} 
                  className="space-y-6"
                >
                  
                  {/* Titre */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                          Votre Compte Administrateur
                        </h1>
                        <p className="text-xs text-muted-foreground font-medium">
                          Dernière étape ! Créez l'accès maître pour <strong className="text-foreground">{companyName || "votre entreprise"}</strong>.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Carte d'affiliation entreprise (Endowment effect) */}
                  <div className="bg-secondary/40 border border-border rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-foreground">
                        {companyName} <span className="text-muted-foreground font-normal">({legalForm})</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                    >
                      Modifier l'entreprise
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="admin-name" className="text-xs font-bold">Nom et prénom complet *</Label>
                      <Input
                        id="admin-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="ex: Jean-Paul MBOUMBA"
                        className="bg-secondary/50 border-border text-foreground text-xs h-10"
                        required
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="admin-email" className="text-xs font-bold">Adresse email de connexion *</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="admin-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="admin@votre-entreprise.ga"
                          className="pl-10 bg-secondary/50 border-border text-foreground text-xs font-medium h-10"
                          required
                        />
                      </div>
                    </div>

                    {/* Mot de passe avec Jauge de robustesse (Dopamine & Clarté) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="admin-password" className="text-xs font-bold">Mot de passe maître *</Label>
                        {password && (
                          <span className="text-[10px] font-bold">
                            Force : <span className={cn(
                              passwordStrength.score === 1 && "text-red-500",
                              passwordStrength.score === 2 && "text-amber-500",
                              passwordStrength.score === 3 && "text-blue-500",
                              passwordStrength.score === 4 && "text-emerald-500"
                            )}>{passwordStrength.label}</span>
                          </span>
                        )}
                      </div>
                      
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="admin-password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimum 6 caractères"
                          className="pl-10 pr-10 bg-secondary/50 border-border text-foreground text-xs h-10"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Barres dynamiques de force du mot de passe */}
                      {password && (
                        <div className="grid grid-cols-4 gap-1.5 pt-1">
                          {[1, 2, 3, 4].map((level) => (
                            <div 
                              key={level} 
                              className={cn(
                                "h-1.5 rounded-full transition-all duration-300",
                                passwordStrength.score >= level ? passwordStrength.color : "bg-muted"
                              )} 
                            />
                          ))}
                        </div>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        Utilisez au moins 6 caractères avec chiffres ou majuscules pour une sécurité renforcée.
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="admin-phone" className="text-xs font-medium flex items-center justify-between">
                        <span>Numéro de téléphone portable</span>
                        <span className="text-[10px] text-muted-foreground">Optionnel</span>
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="admin-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+241 07 00 00 00"
                          className="pl-10 bg-secondary/50 border-border text-foreground text-xs h-10"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-secondary/40 rounded-xl border border-border flex items-start gap-2.5 text-xs text-muted-foreground">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      Votre mot de passe est haché avec <strong>bcrypt</strong> (10 tours de salage) et protégé dans votre coffre SQLite local.
                    </span>
                  </div>

                  {/* Actions de navigation */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      disabled={loading}
                      className="gap-2 cursor-pointer h-12 px-4 rounded-xl"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Retour</span>
                    </Button>

                    <Button 
                      type="submit" 
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-extrabold shadow-md hover:shadow-lg transition-all cursor-pointer text-sm h-12 rounded-xl"
                      disabled={loading}
                    >
                      {loading ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Initialisation de votre espace...</>
                      ) : (
                        <>
                          <span>Lancer Facturier</span>
                          <Sparkles className="w-4 h-4 ml-1 text-amber-300" />
                        </>
                      )}
                    </Button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

          </div>
        </div>

      </div>
    </div>
  )
}

