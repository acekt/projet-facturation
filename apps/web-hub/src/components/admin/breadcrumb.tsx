"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  admin: "Centre de Contrôle",
  tenants: "Tenants & Clients",
  sync: "Parc & Synchronisation",
  finance: "Finance & Volumes",
  adoption: "Adoption & Funnel",
  security: "Piste d'Audit",
  licences: "Plans & Licences",
  announcements: "Annonces & Alertes",
  alerts: "Annonces & Alertes",
  settings: "Paramètres Hub",
};

export function AdminBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Si on est sur la racine "/admin", n'affiche qu'un indicateur discret
  if (segments.length <= 1) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Home className="h-3 w-3 text-primary" />
        <span className="text-foreground">Centre de Contrôle</span>
      </div>
    );
  }

  // Construit les étapes du fil d'Ariane
  let currentPath = "";
  const crumbs = segments.map((seg, index) => {
    currentPath += `/${seg}`;
    const isLast = index === segments.length - 1;
    const label = ROUTE_LABELS[seg] || (seg.length > 12 ? `${seg.slice(0, 8)}...` : seg);

    return {
      href: currentPath,
      label,
      isLast,
    };
  });

  return (
    <nav aria-label="Fil d'Ariane" className="hidden lg:flex items-center gap-1.5 text-[11px] font-medium">
      <Link
        href="/admin"
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="h-3 w-3 text-primary" />
        <span>Hub</span>
      </Link>

      {crumbs.slice(1).map((crumb, idx) => (
        <div key={crumb.href} className="flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          {crumb.isLast ? (
            <span className="text-primary font-semibold truncate max-w-[200px]">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[150px]"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
