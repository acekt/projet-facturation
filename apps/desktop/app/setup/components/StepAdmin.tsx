'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  UserCheck,
  CheckCircle2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Phone,
  ShieldCheck,
  ChevronLeft,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSetupWizard } from '../hooks/useSetupWizard';

interface StepAdminProps {
  wizard: ReturnType<typeof useSetupWizard>;
}

export function StepAdmin({ wizard }: StepAdminProps) {
  const {
    companyName,
    legalForm,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    phone,
    setPhone,
    loading,
    passwordStrength,
    setStep,
    handleSubmit,
  } = wizard;

  return (
    <motion.form
      key="step-2"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2 }}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
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
              Dernière étape ! Créez l'accès maître pour <strong className="text-foreground">{companyName || 'votre entreprise'}</strong>.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-secondary/40 border border-border rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="admin-password" className="text-xs font-bold">Mot de passe maître *</Label>
            {password && (
              <span className="text-[10px] font-bold">
                Force : <span className={cn(
                  passwordStrength.score === 1 && 'text-red-500',
                  passwordStrength.score === 2 && 'text-amber-500',
                  passwordStrength.score === 3 && 'text-blue-500',
                  passwordStrength.score === 4 && 'text-emerald-500'
                )}>{passwordStrength.label}</span>
              </span>
            )}
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 caractères (Majuscule, minuscule, chiffre)"
              className="pl-10 pr-10 bg-secondary/50 border-border text-foreground text-xs h-10"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {password && (
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    passwordStrength.score >= level ? passwordStrength.color : 'bg-muted'
                  )}
                />
              ))}
            </div>
          )}
          <span className="text-[10px] text-muted-foreground">
            Utilisez au moins 8 caractères avec chiffres et majuscules pour une sécurité renforcée.
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
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Initialisation de votre espace...
            </>
          ) : (
            <>
              <span>Lancer Facturier</span>
              <Sparkles className="w-4 h-4 ml-1 text-amber-300" />
            </>
          )}
        </Button>
      </div>
    </motion.form>
  );
}
