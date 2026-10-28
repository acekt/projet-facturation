import { Suspense } from "react";
import type { Metadata } from "next";
import { getAnnouncementsAndAlerts } from "@/lib/kpi/announcementActions";
import { AnnouncementsAlertsView } from "@/components/admin/announcements-alerts-view";

export const metadata: Metadata = {
  title: "Annonces & Centre d'Alertes | Hub Facturier",
  description: "Diffusion descendante vers les terminaux Desktop et résolution des alertes de supervision du Hub.",
};

export const instant = false;

async function AnnouncementsAlertsLoader() {
  const data = await getAnnouncementsAndAlerts();
  return <AnnouncementsAlertsView initialData={data} />;
}

function AnnouncementsAlertsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-28 rounded-2xl bg-card border border-border" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-card border border-border" />
        ))}
      </div>
      <div className="h-96 rounded-2xl bg-card border border-border" />
    </div>
  );
}

export default function AdminAnnouncementsPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<AnnouncementsAlertsSkeleton />}>
        <AnnouncementsAlertsLoader />
      </Suspense>
    </div>
  );
}
