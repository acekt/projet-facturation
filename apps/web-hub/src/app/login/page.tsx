import Image from "next/image";
import { LoginForm } from "./login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { ShieldCheck, Sparkles } from "lucide-react";
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
            <LoginForm initialMessage={message} />
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
