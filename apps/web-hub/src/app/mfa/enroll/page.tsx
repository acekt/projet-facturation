"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { ShieldCheck, Loader2, Copy, Check, ArrowRight, QrCode } from "lucide-react";
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

export default function MfaEnrollPage() {
  const router = useRouter();
  const supabase = createClient();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function startEnrollment() {
      try {
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `Superadmin-${new Date().toISOString().slice(0, 10)}`,
          issuer: "Facturier Hub",
        });

        if (enrollError) {
          setError(enrollError.message);
          return;
        }

        setFactorId(data.id);
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Erreur lors de l'initialisation de l'enrôlement"
        );
      } finally {
        setEnrollLoading(false);
      }
    }

    startEnrollment();
  }, [supabase]);

  const handleCopySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
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
        setError("Code invalide. Vérifiez l'heure de votre appareil et réessayez.");
        return;
      }

      // Enrôlement réussi et session passée en AAL2
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la confirmation du facteur"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-background text-foreground relative transition-colors selection:bg-primary/20">
      {/* Sélecteur de thème discret */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md border-border bg-card shadow-2xl">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-sm">
            <QrCode className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">
            Enrôlement Double Facteur (TOTP)
          </CardTitle>
          <CardDescription className="text-muted-foreground text-xs">
            Scannez ce QR Code avec votre application d&apos;authentification (Google Authenticator, Microsoft Authenticator, 1Password) pour activer le niveau de sécurité AAL2.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {enrollLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground text-xs">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Génération de la clé cryptographique...</span>
            </div>
          ) : (
            <>
              {qrCode && (
                <div className="flex justify-center p-3 bg-white rounded-2xl mx-auto w-fit shadow-md border border-border">
                  {/* Le QR Code SVG renvoyé par Supabase */}
                  <img
                    src={qrCode}
                    alt="QR Code TOTP"
                    className="w-44 h-44 object-contain"
                  />
                </div>
              )}

              {secret && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>Clé secrète (saisie manuelle) :</span>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="text-primary hover:underline flex items-center gap-1 font-mono text-[11px]"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3" /> Copié
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copier
                        </>
                      )}
                    </button>
                  </div>
                  <div className="bg-secondary/70 border border-border rounded-xl p-2.5 text-center font-mono text-xs tracking-wider text-foreground select-all">
                    {secret}
                  </div>
                </div>
              )}

              <form onSubmit={handleConfirm} className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="enroll-code" className="text-xs font-medium text-foreground">
                    Code de confirmation (6 chiffres)
                  </Label>
                  <Input
                    id="enroll-code"
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
                      Activation du facteur...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Activer et accéder au Hub
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}
        </CardContent>

        <CardFooter className="flex justify-center border-t border-border pt-3">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Annuler et revenir à la connexion
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
