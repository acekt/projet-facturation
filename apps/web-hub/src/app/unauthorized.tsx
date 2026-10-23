import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground transition-colors selection:bg-primary/20">
      <Card className="w-full max-w-md border-border bg-card shadow-2xl">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-sm">
            <Lock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Session Requise — 401
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Vous devez être authentifié avec un compte Super Admin pour accéder aux modules du Hub Web.
          </CardDescription>
        </CardHeader>

        <CardContent className="text-center text-xs text-muted-foreground">
          Les sessions inactives sont automatiquement révoquées pour assurer la protection intégrale des données SaaS multi-tenant.
        </CardContent>

        <CardFooter className="pt-6">
          <Button asChild className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium">
            <Link href="/login">
              Se connecter au Hub
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
