import Link from "next/link";
import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground transition-colors selection:bg-primary/20">
      <Card className="w-full max-w-md border-border bg-card shadow-2xl">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive shadow-sm">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Accès Refusé — 403
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Ce portail Hub est strictement restreint aux membres accrédités au rôle{" "}
            <span className="font-semibold text-destructive">Super Administrateur</span>.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 text-xs text-muted-foreground bg-secondary/50 p-4 rounded-xl mx-6 border border-border">
          <div className="flex justify-between py-1 border-b border-border">
            <span>Isolation du tenant :</span>
            <span className="text-foreground font-mono">Multi-Tenant Strict</span>
          </div>
          <div className="flex justify-between py-1 border-b border-border">
            <span>Politique de sécurité :</span>
            <span className="text-foreground font-mono">ADR-0007 / AAL2</span>
          </div>
          <div className="flex justify-between py-1">
            <span>Traçabilité :</span>
            <span className="text-accent font-mono">hub_audit_logs</span>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 pt-6">
          <Button asChild className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/login">
              <LogOut className="mr-2 h-4 w-4" />
              Changer de compte
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full border-border text-foreground hover:bg-secondary">
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à l&apos;accueil de connexion
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
