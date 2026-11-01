'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useStore } from '@/lib/store';
import { setupApp } from '@/app/actions/setup.actions';

export const POPULAR_LEGAL_FORMS = ['SARL', 'SA', 'SAS', 'SUARL', 'Entreprise Individuelle'] as const;

/**
 * Validation stricte anti-valeurs fictives (J7 / P7).
 * Empêche les placeholders bidons (TODO, 000000, 123456, N/A, TEST, DUMMY, etc.).
 */
export function isValidGabonNif(nif: string): boolean {
  const trimmed = nif.trim().toUpperCase();
  if (!trimmed) return true; // Facultatif à la saisie, mais si fourni, doit être valide
  const dummyPattern = /^(TODO|NA|N\/A|TEST|DUMMY|EXEMPLE|00000000|12345678|NIF-)/i;
  if (dummyPattern.test(trimmed)) return false;
  // Format DGI standard : 6 à 9 caractères alphanumériques
  const formatRegex = /^[0-9A-Z]{6,12}$/;
  return formatRegex.test(trimmed);
}

export function isValidGabonRccm(rccm: string): boolean {
  const trimmed = rccm.trim().toUpperCase();
  if (!trimmed) return true;
  const dummyPattern = /^(TODO|NA|N\/A|TEST|DUMMY|EXEMPLE|0000|1234|RCCM-)/i;
  if (dummyPattern.test(trimmed)) return false;
  // Format OHADA / Gabon : au moins 6 caractères alphanumériques avec / ou -
  return trimmed.length >= 6 && !trimmed.includes(' ');
}

export function isValidIban(iban: string): boolean {
  const trimmed = iban.trim().replace(/\s+/g, '').toUpperCase();
  if (!trimmed) return true;
  const dummyPattern = /^(TODO|NA|N\/A|TEST|DUMMY|123456789)/i;
  if (dummyPattern.test(trimmed)) return false;
  // IBAN Gabon (GA + 25 chars = 27) ou format IBAN générique (15-34 chars)
  const ibanRegex = /^[A-Z]{2}[0-9A-Z]{13,32}$/;
  return ibanRegex.test(trimmed);
}

export function useSetupWizard() {
  const router = useRouter();
  const setUser = useStore((state) => state.setUser);

  const [step, setStep] = React.useState<1 | 2>(1);
  const [companyTab, setCompanyTab] = React.useState<'identity' | 'billing' | 'bank' | 'security'>('identity');
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  // 1. Identité
  const [companyName, setCompanyName] = React.useState('');
  const [legalForm, setLegalForm] = React.useState('SARL');
  const [isCustomLegalForm, setIsCustomLegalForm] = React.useState(false);
  const [nif, setNif] = React.useState('');
  const [rccm, setRccm] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [companyPhone, setCompanyPhone] = React.useState('');
  const [companyEmail, setCompanyEmail] = React.useState('');
  const [logo, setLogo] = React.useState<string | null>(null);

  // 2. Facturation & Fiscalité
  const [companyCode, setCompanyCode] = React.useState('FAC');
  const [isCodeCustom, setIsCodeCustom] = React.useState(false);
  const [tvaRate, setTvaRate] = React.useState<number>(18.0);
  const [cssRate, setCssRate] = React.useState<number>(1.0);
  const [tpsRate, setTpsRate] = React.useState<number>(9.5);
  const [mentionsLegales, setMentionsLegales] = React.useState('');

  // 3. Banque
  const [bankName, setBankName] = React.useState('');
  const [bankAgency, setBankAgency] = React.useState('');
  const [accountNumber, setAccountNumber] = React.useState('');
  const [swiftCode, setSwiftCode] = React.useState('');
  const [iban, setIban] = React.useState('');

  // 4. Sécurité
  const [sessionTimeout, setSessionTimeout] = React.useState<number>(60);

  // 5. Administrateur
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [phone, setPhone] = React.useState('');

  const handleCompanyNameChange = (val: string) => {
    setCompanyName(val);
    if (!isCodeCustom) {
      const words = val.trim().split(/\s+/).filter(Boolean);
      let acronym = '';
      if (words.length >= 2) {
        acronym = words.map((w) => w[0]).join('').slice(0, 4).toUpperCase();
      } else if (words.length === 1 && words[0].length >= 2) {
        acronym = words[0].replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
      } else {
        acronym = 'FAC';
      }
      if (acronym.length >= 2) {
        setCompanyCode(acronym);
      }
    }
  };

  const [customLegalFormValue, setCustomLegalFormValue] = React.useState('');

  const handleSelectLegalForm = (form: string) => {
    if (form === 'Autre') {
      setIsCustomLegalForm(true);
      setLegalForm(customLegalFormValue);
    } else {
      setIsCustomLegalForm(false);
      setLegalForm(form);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Le fichier du logo est trop volumineux (max 2 Mo)');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogo(reader.result as string);
      toast.success('Logo ajouté avec succès');
    };
    reader.readAsDataURL(file);
  };

  // Progress scores
  const identityProgress = React.useMemo(() => {
    let score = 0;
    if (companyName.trim().length >= 2) score += 35;
    if (legalForm.trim()) score += 25;
    if (nif.trim()) score += 15;
    if (address.trim()) score += 10;
    if (companyPhone.trim() || companyEmail.trim()) score += 10;
    if (logo) score += 5;
    return Math.min(100, score);
  }, [companyName, legalForm, nif, address, companyPhone, companyEmail, logo]);

  const billingProgress = React.useMemo(() => {
    let score = 70;
    if (companyCode.trim()) score += 15;
    if (tvaRate > 0 && cssRate > 0) score += 15;
    return Math.min(100, score);
  }, [companyCode, tvaRate, cssRate]);

  const bankProgress = React.useMemo(() => {
    if (!bankName.trim() && !accountNumber.trim() && !iban.trim()) return 0;
    let score = 0;
    if (bankName.trim()) score += 40;
    if (accountNumber.trim()) score += 40;
    if (swiftCode.trim() || iban.trim() || bankAgency.trim()) score += 20;
    return Math.min(100, score);
  }, [bankName, accountNumber, swiftCode, iban, bankAgency]);

  const securityProgress = 100;

  const companyOverallProgress = React.useMemo(() => {
    const weighted = Math.round(
      identityProgress * 0.45 +
      billingProgress * 0.35 +
      bankProgress * 0.10 +
      securityProgress * 0.10
    );
    return Math.min(100, Math.max(20, weighted));
  }, [identityProgress, billingProgress, bankProgress]);

  const globalProgress = React.useMemo(() => {
    if (step === 1) return 50;
    let s2 = 75;
    if (name.trim().length >= 2) s2 += 10;
    if (email.trim().includes('@')) s2 += 5;
    if (password.length >= 6) s2 += 10;
    return Math.min(100, s2);
  }, [step, name, email, password]);

  const passwordStrength = React.useMemo(() => {
    if (!password) return { score: 0, label: '', color: 'bg-muted' };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { score: 1, label: 'Faible', color: 'bg-red-500' };
    if (score === 2) return { score: 2, label: 'Moyen', color: 'bg-amber-500' };
    if (score === 3) return { score: 3, label: 'Bon', color: 'bg-blue-500' };
    return { score: 4, label: 'Excellent', color: 'bg-emerald-500' };
  }, [password]);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error('Veuillez renseigner le nom de votre entreprise');
      setCompanyTab('identity');
      return;
    }
    if (!legalForm.trim()) {
      toast.error('Veuillez choisir la forme juridique');
      setCompanyTab('identity');
      return;
    }
    if (nif.trim() && !isValidGabonNif(nif)) {
      toast.error('Le NIF saisi semble fictif ou invalide. Respectez le format officiel ou laissez vide.');
      setCompanyTab('identity');
      return;
    }
    if (rccm.trim() && !isValidGabonRccm(rccm)) {
      toast.error('Le RCCM saisi semble fictif ou invalide. Respectez le format officiel ou laissez vide.');
      setCompanyTab('identity');
      return;
    }
    if (iban.trim() && !isValidIban(iban)) {
      toast.error("L'IBAN saisi n'a pas un format bancaire valide.");
      setCompanyTab('bank');
      return;
    }
    if (!companyCode.trim()) {
      toast.error("Le code sigle de l'entreprise est requis (ex: GM)");
      setCompanyTab('billing');
      return;
    }
    setStep(2);
  };

  const cleanCompanyCode = (companyCode || 'GM').trim().toUpperCase();
  const computedInvoicePrefix = `FAC-${cleanCompanyCode}-`;
  const computedQuotePrefix = `DEV-${cleanCompanyCode}-`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Veuillez saisir votre nom complet');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error('Veuillez saisir une adresse email valide');
      return;
    }
    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      toast.error('Le mot de passe doit comporter au moins 8 caractères, une majuscule, une minuscule et un chiffre');
      return;
    }

    setLoading(true);
    try {
      const res = await setupApp({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || null,
        companyName: companyName.trim(),
        legalForm: legalForm.trim(),
        nif: nif.trim() || null,
        rccm: rccm.trim() || null,
        address: address.trim() || null,
        companyPhone: companyPhone.trim() || null,
        companyEmail: companyEmail.trim() || null,
        logo: logo || null,
        companyCode: cleanCompanyCode,
        invoicePrefix: computedInvoicePrefix,
        quotePrefix: computedQuotePrefix,
        tvaRate,
        cssRate,
        tpsRate,
        mentionsLegales: mentionsLegales.trim() || null,
        bankName: bankName.trim() || null,
        bankAgency: bankAgency.trim() || null,
        accountNumber: accountNumber.trim() || null,
        swiftCode: swiftCode.trim() || null,
        iban: iban.trim() || null,
        sessionTimeout,
      });

      if (res.success) {
        toast.success('Félicitations ! Votre espace Facturier est initialisé.');
        if (res.data?.user) {
          setUser(res.data.user);
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
        router.push('/');
        router.refresh();
      } else {
        toast.error(res.error || "Erreur lors de l'initialisation de l'application");
      }
    } catch {
      toast.error("Impossible d'initialiser la base locale");
    } finally {
      setLoading(false);
    }
  };

  return {
    step,
    setStep,
    companyTab,
    setCompanyTab,
    loading,
    showPassword,
    setShowPassword,
    companyName,
    setCompanyName,
    legalForm,
    setLegalForm,
    isCustomLegalForm,
    setIsCustomLegalForm,
    nif,
    setNif,
    rccm,
    setRccm,
    address,
    setAddress,
    companyPhone,
    setCompanyPhone,
    companyEmail,
    setCompanyEmail,
    logo,
    setLogo,
    companyCode,
    setCompanyCode,
    isCodeCustom,
    setIsCodeCustom,
    tvaRate,
    setTvaRate,
    cssRate,
    setCssRate,
    tpsRate,
    setTpsRate,
    mentionsLegales,
    setMentionsLegales,
    bankName,
    setBankName,
    bankAgency,
    setBankAgency,
    accountNumber,
    setAccountNumber,
    swiftCode,
    setSwiftCode,
    iban,
    setIban,
    sessionTimeout,
    setSessionTimeout,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    phone,
    setPhone,
    handleCompanyNameChange,
    handleSelectLegalForm,
    handleLogoUpload,
    handleNextStep,
    customLegalFormValue,
    setCustomLegalFormValue,
    handleSubmit,
    identityProgress,
    billingProgress,
    bankProgress,
    securityProgress,
    companyOverallProgress,
    globalProgress,
    passwordStrength,
    cleanCompanyCode,
    computedInvoicePrefix,
    computedQuotePrefix,
  };
}
