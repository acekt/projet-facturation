import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTenant360 } from "@/lib/kpi/tenant360";
import { Tenant360View } from "@/components/admin/tenant-360-view";
import { ArrowLeft, Building2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export const instant = false;

export default async function TenantDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const data = await getTenant360(id);

  if (!data) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-card border border-border flex items-center justify-center text-muted-foreground shadow-xs">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-foreground">Entreprise non trouvée</h2>
          <p className="text-xs text-muted-foreground">
            Le tenant identifié par <code className="font-mono text-primary">{id}</code> n&apos;existe pas ou a été supprimé.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="text-xs border-border bg-secondary/50 hover:bg-secondary text-foreground cursor-pointer">
          <Link href="/admin/tenants">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Retour aux tenants
          </Link>
        </Button>
      </div>
    );
  }

  return <Tenant360View data={data} />;
}
