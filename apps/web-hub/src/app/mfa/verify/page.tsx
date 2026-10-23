"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { KeyRound, ShieldCheck, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

import { ThemeToggle } from "@/components/theme-toggle";

export default function MfaVerifyPage() {
  const router = useRouter();
  const supabase = createClient();

  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFactor() {
      try {
        const { data, error: factorsError } =
          await supabase.auth.mfa.listFactors();

        if (factorsError) {
          setError(factorsError.message);
          return;
        }

        const totp = data?.totp?.find((f) => f.status === "verified") || data?.totp?.[0];

        if (!totp) {
          // Aucun facteur enregistré -> rediriger vers l'enrôlement
          router.push("/mfa/enroll");
          return;
        }

        setFactorId(totp.id);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Erreur d'initialisation du second facteur"
        );
      } finally {
        setInitLoading(false);
      }
    }

    loadFactor();
  }, [router, supabase]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length < 6) return;

    setLoading(true);
    setError(null);

    try {
      const { error: verifyError } =
        await supabase.auth.mfa.challengeAndVerify({
          factorId,
          code: code.trim(),
        });

      if (verifyError) {
        setError("Code de vérification invalide ou expiré. Réessayez.");
        return;
      }

      // Succès -> redirection vers le tableau de bord
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la validation du code TOTP"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-background text-foreground relative transition-colors selection:bg-primary/20">
      {/* Sélecteur de thème discret */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-sm border-border bg-card shadow-2xl">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-sm">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">
            Vérification MFA (AAL2)
          </CardTitle>
          <CardDescription className="text-muted-foreground text-xs">
            Entrez le code à 6 chiffres généré par votre application d&apos;authentification (Google Authenticator, 1Password, etc.).
          </CardDescription>
        </CardHeader>

        <CardContent>
          {initLoading ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground text-xs">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Chargement du facteur de sécurité...</span>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="totp-code" className="text-xs font-medium text-foreground">
                  Code TOTP temporaire
                </Label>
                <div className="relative">
                  <Input
                    id="totp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className="font-mono text-center text-lg tracking-widest bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                    autoFocus
                  />
                  <KeyRound className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {error && (
                <div className="text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-xl">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validation en cours...
                  </>
                ) : (
                  <>
                    Valider l&apos;accès
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2 pt-2 border-t border-border text-xs">
          <button
            type="button"
            onClick={() => router.push("/mfa/enroll")}
            className="text-primary hover:underline transition-colors"
          >
            Configurer un nouvel appareil MFA
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Se déconnecter
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
