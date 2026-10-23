"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@workspace/ui/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Activity,
  DollarSign,
  TrendingUp,
  ShieldAlert,
  CreditCard,
  BellRing,
  Settings,
  Layers,
  Sparkles,
} from "lucide-react";

export const ADMIN_NAV_ITEMS = [
  {
    title: "Centre de Contrôle",
    href: "/admin",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    title: "Tenants & Clients",
    href: "/admin/tenants",
    icon: Building2,
    badge: null,
  },
  {
    title: "Parc & Synchro",
    href: "/admin/sync",
    icon: Activity,
    badge: "Live",
  },
  {
    title: "Finance & Volumes",
    href: "/admin/finance",
    icon: DollarSign,
    badge: null,
  },
  {
    title: "Adoption & Funnel",
    href: "/admin/adoption",
    icon: TrendingUp,
    badge: null,
  },
  {
    title: "Audit & Sécurité",
    href: "/admin/security",
    icon: ShieldAlert,
    badge: null,
  },
  {
    title: "Plans & Licences",
    href: "/admin/licences",
    icon: CreditCard,
    badge: null,
  },
  {
    title: "Annonces & Alertes",
    href: "/admin/announcements",
    icon: BellRing,
    badge: null,
  },
  {
    title: "Paramètres Hub",
    href: "/admin/settings",
    icon: Settings,
    badge: null,
  },
];

export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1 px-3 py-4">
      {ADMIN_NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative",
              isActive
                ? "bg-primary/10 text-primary border border-primary/20 shadow-sm font-semibold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-primary before:rounded-r-full"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
            )}
          >
            <div className="flex items-center gap-3">
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span>{item.title}</span>
            </div>
            {item.badge && (
              <span className="px-1.5 py-0.2 text-[9px] font-mono font-semibold rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function HubBrandHeader() {
  return (
    <div className="h-16 flex items-center gap-3 px-5 border-b border-border bg-card transition-colors">
      <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/20">
        <Layers className="h-5 w-5" />
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <span className="font-bold tracking-tight text-foreground text-sm">
            Facturier Hub
          </span>
          <span className="text-[9px] uppercase font-mono font-semibold px-1 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
            v1.0
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Sparkles className="h-2.5 w-2.5 text-primary" />
          <span>Super Admin Cloud</span>
        </div>
      </div>
    </div>
  );
}
