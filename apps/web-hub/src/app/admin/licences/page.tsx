import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getPlansAndLicences } from "@/lib/kpi/licenceActions";
import { LicencesManagementView } from "@/components/admin/licences-management-view";

export const metadata: Metadata = {
  title: "Gestion des Plans & Licences | Hub Facturier",
  description: "Catalogue des abonnements SaaS, quotas techniques et renouvellement proactif des licences tenants.",
};

export const instant = false;

async function LicencesLoader() {
  await connection();
  const data = await getPlansAndLicences();
  return <LicencesManagementView initialData={data} />;
}

function LicencesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-28 rounded-2xl bg-card border border-border" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-card border border-border" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-80 rounded-2xl bg-card border border-border" />
        ))}
      </div>
    </div>
  );
}

export default function AdminLicencesPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<LicencesSkeleton />}>
        <LicencesLoader />
      </Suspense>
    </div>
  );
}
