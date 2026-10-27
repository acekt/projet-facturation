"use client";

import * as React from "react";
import { login } from "./actions";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";

interface LoginFormProps {
  initialMessage?: string;
}

export function LoginForm({ initialMessage }: LoginFormProps) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(initialMessage || null);

  // Nettoyer l'URL pour ne pas laisser le paramètre ?message=... persister
  React.useEffect(() => {
    if (initialMessage && typeof window !== "undefined") {
      setMessage(initialMessage);
      const url = new URL(window.location.href);
      url.searchParams.delete("message");
      window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""));
    }
  }, [initialMessage]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (isSubmitting) {
      e.preventDefault();
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
  };

  return (
    <form action={login} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-xs font-medium text-foreground">
          Adresse Email Superadmin
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@facturier.cloud"
          className="bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10 text-xs"
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-xs font-medium text-foreground">
            Mot de passe
          </Label>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10 text-xs pr-10"
            required
            disabled={isSubmitting}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            disabled={isSubmitting}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-xl text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 flex items-center gap-2">
          <Lock className="h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/20 h-10 text-xs cursor-pointer transition-all"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Vérification de l&apos;accès...
          </>
        ) : (
          "Accéder au Centre de Contrôle"
        )}
      </Button>
    </form>
  );
}
