import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getSecurityAuditLogs } from "@/lib/kpi/securityQueries";
import { SecurityAuditView } from "@/components/admin/security-audit-view";

export const metadata: Metadata = {
  title: "Audit & Sécurité Immuable | Hub Facturier",
  description: "Piste d'audit infalsifiable des actions Super Admin, accès d'urgence bris de glace et traçabilité RGPD.",
};

export const instant = false;

async function SecurityAuditLoader() {
  await connection();
  const data = await getSecurityAuditLogs();
  return <SecurityAuditView initialData={data} />;
}

function SecurityAuditSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-28 rounded-2xl bg-card border border-border" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-card border border-border" />
        ))}
      </div>
      <div className="h-96 rounded-2xl bg-card border border-border" />
    </div>
  );
}

export default function AdminSecurityPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<SecurityAuditSkeleton />}>
        <SecurityAuditLoader />
      </Suspense>
    </div>
  );
}
