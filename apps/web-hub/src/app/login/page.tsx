import Image from "next/image";
import { login } from "./actions";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { ShieldCheck, Lock, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const message = resolvedSearchParams.message;

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-background text-foreground relative transition-colors selection:bg-primary/20">
      {/* Sélecteur de thème discret en haut à droite */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* En-tête de marque institutionnelle */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative h-14 w-14 rounded-2xl bg-white dark:bg-card border border-border flex items-center justify-center shadow-lg shadow-primary/10 ring-4 ring-primary/5 p-2">
            <Image
              src="/logo.png"
              alt="Logo Facturier"
              width={48}
              height={48}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Facturier Hub
              </h1>
              <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Cloud
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              <span>Console Super Admin & Télémétrie Centralisée</span>
            </p>
          </div>
        </div>

        {/* Carte de Connexion */}
        <Card className="bg-card border-border shadow-xl">
          <CardHeader className="space-y-1.5 pb-4">
            <CardTitle className="text-lg font-semibold text-foreground">
              Connexion Sécurisée
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Accès réservé aux administrateurs de la plateforme
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-foreground">
                  Adresse Email Superadmin
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="admin@facturier.cloud"
                  className="bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10 text-xs"
                  required
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
                    type="password"
                    placeholder="••••••••••••"
                    className="bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10 text-xs"
                    required
                  />
                </div>
              </div>

              {message && (
                <div className="p-3 rounded-xl text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 flex items-center gap-2">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>{message}</span>
                </div>
              )}

              <Button
                formAction={login}
                className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-semibold shadow-md shadow-primary/20 h-10 text-xs cursor-pointer transition-all"
              >
                Accéder au Centre de Contrôle
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Badge de réassurance de sécurité */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground font-medium">
          <ShieldCheck className="h-4 w-4 text-accent" />
          <span>Isolation Multi-Tenant Strict • Chiffrement TLS v1.3</span>
        </div>
      </div>
    </div>
  );
}
