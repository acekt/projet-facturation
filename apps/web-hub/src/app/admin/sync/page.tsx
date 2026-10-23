import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getDetailedSyncFleet } from "@/lib/kpi/fleetQueries";
import { SyncFleetView } from "@/components/admin/sync-fleet-view";
import { Laptop } from "lucide-react";

export const metadata: Metadata = {
  title: "Supervision du Parc & Synchronisation | Hub Facturier",
  description: "Suivi en direct du parc Desktop SQLite, des latences SLA et détection des postes dormants.",
};

export const instant = false;

async function SyncFleetLoader() {
  await connection();
  const data = await getDetailedSyncFleet();
  return <SyncFleetView initialData={data} />;
}

function SyncFleetSkeleton() {
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

export default function AdminSyncPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<SyncFleetSkeleton />}>
        <SyncFleetLoader />
      </Suspense>
    </div>
  );
}
