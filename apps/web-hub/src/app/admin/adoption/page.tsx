import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getAdoptionFunnelData } from "@/lib/kpi/adoptionQueries";
import { AdoptionFunnelView } from "@/components/admin/adoption-funnel-view";

export const metadata: Metadata = {
  title: "Adoption & Funnel SaaS | Hub Facturier",
  description: "Suivi de la conversion d'onboarding, modélisation du Health Score et prévention du churn des clients.",
};

export const instant = false;

async function AdoptionLoader() {
  await connection();
  const data = await getAdoptionFunnelData();
  return <AdoptionFunnelView initialData={data} />;
}

function AdoptionSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-28 rounded-2xl bg-card border border-border" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-card border border-border" />
        ))}
      </div>
      <div className="h-56 rounded-2xl bg-card border border-border" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="h-64 rounded-2xl bg-card border border-border" />
        <div className="lg:col-span-2 h-64 rounded-2xl bg-card border border-border" />
      </div>
      <div className="h-96 rounded-2xl bg-card border border-border" />
    </div>
  );
}

export default function AdminAdoptionPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<AdoptionSkeleton />}>
        <AdoptionLoader />
      </Suspense>
    </div>
  );
}
