"use client";

import { loginUser, syncSupabaseSession } from "@/app/actions/auth.actions";
import { connector } from "@/lib/powersync";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Lock,
  EyeOff,
  Loader2,
  User,
  Building2
} from "lucide-react";

export default function LoginClient() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [rememberMe, setRememberMe] = React.useState(false);
  const [isForgotPassword, setIsForgotPassword] = React.useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useStore((state) => state.setUser);

  // Charger le nom d'utilisateur mémorisé au démarrage
  React.useEffect(() => {
    const savedUsername = localStorage.getItem("facturier_remembered_username");
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  // Gérer l'affichage des erreurs provenant des redirections du middleware
  React.useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      // Nettoyer l'URL sans recharger la page
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());

      if (errorParam === "forbidden") {
        toast.error("Accès non autorisé");
      } else if (errorParam === "session_expired") {
        toast.error("Votre session a expiré");
      } else {
        toast.error("Une erreur est survenue");
      }
    }
  }, [searchParams]);

  // Données du carrousel
  const slides = React.useMemo(() => [
    {
      image: "/login-img-2.svg",
      title: "Gérez avec excellence",
      text: "La solution locale et conforme pour piloter vos factures en toute sérénité."
    },
    {
      image: "/login-img-3.svg",
      title: "Conformité Garantie",
      text: "Calcul strict des taxes locales (TVA, TPS) selon les normes en vigueur."
    },
    {
      image: "/login-img-4.svg",
      title: "Résilience Hors-Ligne",
      text: "Vos données restent accessibles et ultra-rapides, même sans connexion internet."
    }
  ], []);

  // Timer automatique du carrousel
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  // Soumission du formulaire
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      let loggedUser: any = null;
      const cleanEmail = username.trim();

      // 1. Tentative de connexion via Supabase (Cloud & PowerSync)
      try {
        const { user } = await connector.login(cleanEmail, password);

        if (user) {
          // Extraire le rôle
          let rawRole = (user.user_metadata?.role || (user.app_metadata as any)?.role || '').toLowerCase().trim();
          let tenantId = user.user_metadata?.tenant_id;

          // Si le rôle n'est pas explicite dans les métadonnées, tenter de le lire depuis la table profiles Supabase
          if (!rawRole) {
            try {
              const { data: profile } = await connector.client
                .from('profiles')
                .select('role, tenant_id')
                .eq('id', user.id)
                .single();
              if (profile) {
                rawRole = (profile.role || '').toLowerCase().trim();
                if (!tenantId) tenantId = profile.tenant_id;
              }
            } catch (profileErr) {
              console.warn("[Auth Desktop] Lecture profiles:", profileErr);
            }
          }

          // VÉRIFICATION STRICTE : Le Superadmin ne doit JAMAIS se connecter sur le Desktop
          const isSuperAdmin = 
            rawRole === 'superadmin' || 
            rawRole === 'super_admin' || 
            cleanEmail.toLowerCase().includes('superadmin') || 
            (user.email && user.email.toLowerCase().includes('superadmin')) ||
            (user.user_metadata?.name || '').toLowerCase().includes('superadmin') ||
            (user.user_metadata?.name || '').toLowerCase().includes('super admin');

          if (isSuperAdmin) {
            await connector.logout();
            toast.error(
              "Accès refusé : Le rôle Superadmin est réservé exclusivement au Web Hub Cloud. Seuls l'Administrateur et l'Opérateur peuvent se connecter sur cette application Desktop.",
              { duration: 7000 }
            );
            setIsSubmitting(false);
            return;
          }

          // Rôles autorisés sur Desktop : admin et user (opérateur)
          const effectiveRole: 'admin' | 'user' = (rawRole === 'admin' || cleanEmail.startsWith('admin@')) ? 'admin' : 'user';

          loggedUser = {
            id: user.id,
            name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Utilisateur',
            email: user.email || cleanEmail,
            role: effectiveRole,
            tenantId: tenantId || undefined,
            force_password_change: 0,
          };

          // Synchroniser la session locale et le cookie auth
          const syncRes = await syncSupabaseSession(loggedUser);
          if (!syncRes.success) {
            await connector.logout();
            toast.error(syncRes.error || "Erreur de synchronisation locale");
            setIsSubmitting(false);
            return;
          }

          if (syncRes.data?.role) {
            loggedUser.role = syncRes.data.role;
          }
          if (syncRes.data?.force_password_change !== undefined) {
            loggedUser.force_password_change = syncRes.data.force_password_change;
          }
        }
      } catch (cloudErr: any) {
        console.warn("[Auth Desktop] Échec connexion Supabase:", cloudErr);

        const msg = cloudErr?.message || '';
        const isNetworkError =
          msg.includes('Failed to fetch') ||
          msg.includes('NetworkError') ||
          msg.includes('network') ||
          cloudErr?.name === 'TypeError';

        // Compte absent du Cloud (ex: créé via /setup en local) ou réseau indisponible :
        // tentative de repli sur la base SQLite locale.
        const localRes = await loginUser({ username: cleanEmail, password });
        if (localRes.success) {
          const localRole = (localRes.data.user.role || '').toLowerCase().trim();
          if (localRole === 'superadmin' || localRole === 'super_admin' || cleanEmail.toLowerCase().includes('superadmin')) {
            toast.error("Accès refusé : Le rôle Superadmin est réservé au Web Hub Cloud.");
            setIsSubmitting(false);
            return;
          }
          loggedUser = localRes.data.user;
          toast.info("Mode Hors-Ligne : connexion validée localement.");
        } else {
          if (isNetworkError) {
            toast.error("Impossible de contacter le serveur et aucun compte local correspondant trouvé.");
          } else {
            toast.error(localRes.error || "Identifiants invalides (email ou mot de passe incorrect)");
          }
          setIsSubmitting(false);
          return;
        }
      }

      if (loggedUser) {
        if (rememberMe) {
          localStorage.setItem("facturier_remembered_username", cleanEmail);
        } else {
          localStorage.removeItem("facturier_remembered_username");
        }

        if (loggedUser.force_password_change) {
          toast.warning("Veuillez définir votre nouveau mot de passe personnel pour continuer.");
        } else {
          toast.success("Connexion réussie. Bienvenue dans Facturier !");
        }
        setUser(loggedUser);
        await new Promise((resolve) => setTimeout(resolve, 250));
        window.location.href = "/";
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes("not found on the server") || err.message.includes("failed-to-find-server-action")) {
          toast.info("Mise à jour du serveur détectée. Actualisation en cours...", { duration: 2500 });
          setTimeout(() => {
            window.location.reload();
          }, 500);
          return;
        }
        toast.error(`Erreur: ${err.message}`);
      } else {
        toast.error("Impossible de finaliser la connexion");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      toast.error("Veuillez saisir votre email");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await connector.client.auth.resetPasswordForEmail(username.trim());
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Si ce compte existe, un email de réinitialisation vous a été envoyé.");
        setIsForgotPassword(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la demande de réinitialisation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-background transition-colors duration-300">
      {/* Container Principal : Plein écran sans bordures */}
      <div className="w-full h-full flex flex-col md:flex-row">
        
        {/* ========================================================================= */}
        {/* COLONNE GAUCHE (ILLUSTRATION) */}
        {/* ========================================================================= */}
        <div className="hidden md:flex flex-col relative w-[45%] h-full bg-primary overflow-hidden p-10 justify-between">
          
          {/* Logo et titre du haut */}
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-12">
              <div className="relative w-12 h-12 bg-white rounded-lg shadow-md overflow-hidden">
                <Image src="/logo.png" alt="Logo Facturier" fill className="object-contain p-1" />
              </div>
              <span className="text-primary-foreground font-bold text-xl tracking-tight">Facturier</span>
            </div>
            
            {/* Zone Centrale de l'Image (Carrousel) */}
            <div className="relative h-[480px]">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentSlide}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="absolute inset-0 flex flex-col h-full"
                >
                  <div className="flex-1 flex items-center justify-center mb-8 relative">
                    <div className="absolute inset-0 bg-primary-foreground/5 rounded-3xl blur-2xl" />
                    <div className="relative w-[340px] h-[340px] drop-shadow-2xl">
                      <Image 
                        src={slides[currentSlide].image} 
                        alt={slides[currentSlide].title} 
                        fill 
                        className="object-contain filter brightness-[1.1] contrast-[1.05]"
                        priority
                      />
                    </div>
                  </div>

                  {/* Textes du bas avec carrousel dynamique */}
                  <div className="mt-auto">
                    <h2 className="text-3xl font-bold text-primary-foreground mb-4 tracking-tight leading-tight">
                      {slides[currentSlide].title}
                    </h2>
                    <p className="text-primary-foreground/80 text-[15px] leading-relaxed max-w-md font-medium">
                      {slides[currentSlide].text}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Indicateurs Carrousel */}
            <div className="flex items-center gap-2 mt-12">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  aria-label={`Slide ${index + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    currentSlide === index ? "w-8 bg-primary-foreground" : "w-2 bg-primary-foreground/30 hover:bg-primary-foreground/50"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Décoration d'arrière-plan abstraite */}
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-foreground/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary-foreground/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />
        </div>

        {/* ========================================================================= */}
        {/* COLONNE DROITE (BLANCHE) : FORMULAIRE */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col justify-center items-center p-8 sm:p-12 md:p-16 relative bg-background overflow-y-auto">
          
          <div className="w-full max-w-[380px] space-y-10 my-auto">
            
            {/* Logo & Titre */}
            <div className="text-center space-y-2 mb-8">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center ring-4 ring-background shadow-sm">
                  <User className="w-8 h-8 text-primary" />
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                {isForgotPassword ? "Mot de passe oublié" : "Bienvenue"}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                {isForgotPassword 
                  ? "Entrez votre adresse email pour réinitialiser votre accès." 
                  : "Connectez-vous à Facturier pour gérer votre activité."}
              </p>
            </div>

            {/* Formulaire */}
            <form onSubmit={isForgotPassword ? handleForgotPassword : handleLogin} className="space-y-6">
              
              <div className="space-y-4">
                {/* Champ Email */}
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Email
                  </label>
                  <Input
                    id="username"
                    type="email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="jean@facturier.ga"
                    className="bg-secondary border-border text-foreground"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                {/* Champ Mot de passe (Uniquement si pas en mode Mdp Oublié) */}
                {!isForgotPassword && (
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-secondary border-border text-foreground pr-10"
                        required
                        disabled={isSubmitting}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Options (Se souvenir de moi & Mdp Oublié) */}
              {!isForgotPassword && (
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <span className="text-[13px] text-muted-foreground font-medium select-none group-hover:text-foreground transition-colors">
                      Se souvenir de moi
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-[13px] font-bold text-primary hover:text-primary/80 transition-colors"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {isForgotPassword ? "Envoi..." : "Connexion..."}</>
                  ) : (
                    isForgotPassword ? "Réinitialiser le mot de passe" : "Se connecter"
                  )}
                </Button>

                {isForgotPassword && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setIsForgotPassword(false)}
                  >
                    Retour à la connexion
                  </Button>
                )}

                {!isForgotPassword && (
                  <div className="pt-2 flex flex-col gap-3">
                    <div className="relative my-1">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground font-semibold">
                          Première utilisation ?
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-border hover:bg-secondary text-foreground flex items-center justify-center gap-2 font-medium cursor-pointer"
                      onClick={() => router.push('/setup')}
                      disabled={isSubmitting}
                    >
                      <Building2 className="w-4 h-4 text-primary" />
                      <span>Configurer mon entreprise (Setup)</span>
                    </Button>
                  </div>
                )}
              </div>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
}
