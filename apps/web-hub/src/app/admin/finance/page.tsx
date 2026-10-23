import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getFinancialOverview } from "@/lib/kpi/financeQueries";
import { FinanceOverviewView } from "@/components/admin/finance-overview-view";

export const metadata: Metadata = {
  title: "Supervision Financière & Volumes | Hub Facturier",
  description: "Pilotage consolidé du chiffre d'affaires facturé, des encaissements réels et des encours clients multi-tenant.",
};

export const instant = false;

async function FinanceLoader() {
  await connection();
  const data = await getFinancialOverview();
  return <FinanceOverviewView initialData={data} />;
}

function FinanceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-28 rounded-2xl bg-card border border-border" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-card border border-border" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-72 rounded-2xl bg-card border border-border" />
        <div className="h-72 rounded-2xl bg-card border border-border" />
      </div>
      <div className="h-96 rounded-2xl bg-card border border-border" />
    </div>
  );
}

export default function AdminFinancePage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<FinanceSkeleton />}>
        <FinanceLoader />
      </Suspense>
    </div>
  );
}
