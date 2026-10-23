import { Suspense } from "react";
import { connection } from "next/server";
import { getTenantsList } from "@/lib/kpi/tenant360";
import { TenantsTable } from "@/components/admin/tenants-table";
import { Building2 } from "lucide-react";

export const instant = false;

export default async function AdminTenantsPage() {
  await connection();
  const tenants = await getTenantsList();

  return (
    <div className="space-y-6">
      {/* En-tête harmonisé */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Building2 className="h-6 w-6 text-primary" />
              Entreprises Clientes (Tenants)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 font-mono">
              Multi-Tenant RLS
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Gestion du cycle de vie des organisations SaaS, contrôle des abonnements et suspension administrative.
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="h-64 bg-card rounded-2xl border border-border animate-pulse" />
        }
      >
        <TenantsTable initialTenants={tenants} />
      </Suspense>
    </div>
  );
}
