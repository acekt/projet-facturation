'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Building2,
  FileText,
  MapPin,
  Phone,
  Mail,
  Upload,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { POPULAR_LEGAL_FORMS, useSetupWizard } from '../hooks/useSetupWizard';

interface StepIdentityProps {
  wizard: ReturnType<typeof useSetupWizard>;
}

export function StepIdentity({ wizard }: StepIdentityProps) {
  const {
    companyName,
    legalForm,
    isCustomLegalForm,
    setLegalForm,
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
    handleCompanyNameChange,
    handleSelectLegalForm,
    handleLogoUpload,
    customLegalFormValue,
    setCustomLegalFormValue,
  } = wizard;

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      {/* Bannière de réassurance */}
      <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/85 leading-relaxed font-medium">
          <strong>Démarrage express :</strong> Seul le <em>nom commercial</em> est requis pour commencer. Les taux fiscaux (TVA 18%, CSS 1%) et préfixes sont déjà configurés selon les règles CEMAC.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
        {/* Zone Logo */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold flex items-center justify-between">
            <span>Logo officiel</span>
            <span className="text-[10px] text-muted-foreground">Optionnel</span>
          </Label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative min-h-[120px] sm:min-h-[140px] w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-all flex flex-col items-center justify-center p-3 text-center cursor-pointer bg-secondary/30 hover:bg-secondary/50 overflow-hidden group shadow-xs"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLogoUpload}
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
            />
            {logo ? (
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="h-16 max-w-full flex items-center justify-center">
                  <img src={logo} alt="Logo preview" className="max-h-16 max-w-full object-contain" />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-primary font-semibold hover:underline">Changer</span>
                  <span className="text-muted-foreground text-[10px]">•</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogo(null);
                    }}
                    className="text-[10px] text-destructive font-semibold hover:underline cursor-pointer"
                  >
                    Supprimer
                  </button>
                </div>
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
                placeholder="ex: Global Maintenance, Kori Tech..."
                className="pl-10 bg-secondary/60 border-border text-foreground font-semibold text-sm h-11"
                required
                autoFocus
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              💡 Nom qui apparaîtra en en-tête de vos pièces officielles.
            </span>
          </div>

          {/* Forme Juridique */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">Forme Juridique *</Label>
              <span className="text-[10px] text-muted-foreground">Sélectionnez votre structure</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {POPULAR_LEGAL_FORMS.map((form) => (
                <button
                  key={form}
                  type="button"
                  onClick={() => handleSelectLegalForm(form)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1',
                    legalForm === form && !isCustomLegalForm
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs scale-102'
                      : 'bg-secondary/50 text-muted-foreground border-border hover:text-foreground hover:bg-secondary'
                  )}
                >
                  {legalForm === form && !isCustomLegalForm && (
                    <CheckCircle2 className="w-3 h-3 text-primary-foreground shrink-0" />
                  )}
                  <span>{form}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => handleSelectLegalForm('Autre')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border',
                  isCustomLegalForm
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-secondary/50 text-muted-foreground border-border hover:text-foreground'
                )}
              >
                Autre...
              </button>
            </div>

            {isCustomLegalForm && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <Input
                  type="text"
                  value={customLegalFormValue}
                  onChange={(e) => {
                    setCustomLegalFormValue(e.target.value)
                    setLegalForm(e.target.value)
                  }}
                  placeholder="Précisez votre forme juridique (ex: GIE, Association, SASU...)"
                  className="bg-secondary/50 border-border text-foreground text-xs mt-2"
                  required
                  autoFocus
                />
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Identifiants administratifs */}
      <div className="pt-2 border-t border-border/40 space-y-2">
        <span className="text-xs font-bold text-foreground block">
          Identifiants administratifs <span className="font-normal text-muted-foreground text-[10px]">(Optionnels pour démarrer)</span>
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="company-nif" className="text-xs font-medium">NIF (Identifiant Fiscal)</Label>
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

          <div className="space-y-1">
            <Label htmlFor="company-rccm" className="text-xs font-medium">RCCM (Registre du commerce)</Label>
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
      </div>

      {/* Coordonnées & Siège */}
      <div className="pt-2 border-t border-border/40 space-y-2">
        <span className="text-xs font-bold text-foreground block">
          Coordonnées & Siège <span className="font-normal text-muted-foreground text-[10px]">(Optionnels)</span>
        </span>

        <div className="space-y-1">
          <Label htmlFor="company-address" className="text-xs font-medium">Adresse physique & Siège social</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="company-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="ex: Centre-ville, Boulevard Triomphal, Libreville, Gabon"
              className="pl-10 bg-secondary/50 border-border text-foreground text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="company-phone" className="text-xs font-medium">Téléphone entreprise</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="company-phone"
                type="text"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                placeholder="+241 01 23 45 67"
                className="pl-10 bg-secondary/50 border-border text-foreground text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="company-email" className="text-xs font-medium">Email professionnel</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="company-email"
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                placeholder="contact@votre-entreprise.ga"
                className="pl-10 bg-secondary/50 border-border text-foreground text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
