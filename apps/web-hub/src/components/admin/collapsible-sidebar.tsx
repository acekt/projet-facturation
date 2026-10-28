"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@workspace/ui/lib/utils";
import {
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  User,
  LogOut,
} from "lucide-react";
import { ADMIN_NAV_ITEMS } from "./sidebar";

interface CollapsibleSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  userEmail: string;
  userFullName?: string | null;
  mfaLevel?: string;
  logoutAction: () => Promise<void>;
}

export function CollapsibleSidebar({
  collapsed,
  onToggle,
  userEmail,
  userFullName,
  mfaLevel = "AAL2",
  logoutAction,
}: CollapsibleSidebarProps) {
  const pathname = usePathname();
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);

  // Réinitialisation de l'état optimiste dès la complétion du routage
  useEffect(() => {
    setOptimisticPath(null);
  }, [pathname]);

  const currentPath = optimisticPath || pathname;

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 border-r border-border bg-card relative transition-all duration-300 ease-in-out select-none",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Bouton Toggle Rétractation (Inspiré du Desktop) */}
      <button
        type="button"
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-primary/40 transition-colors shadow-lg z-40 focus:outline-none"
        aria-label={collapsed ? "Agrandir le menu latéral" : "Replier le menu latéral"}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* En-tête de marque */}
      <div
        className={cn(
          "h-16 flex items-center border-b border-border bg-card transition-all",
          collapsed ? "justify-center px-2" : "gap-3 px-5"
        )}
      >
        <div className="relative h-9 w-9 rounded-xl bg-white dark:bg-card border border-border shadow-xs overflow-hidden shrink-0 flex items-center justify-center p-1">
          <Image
            src="/logo.png"
            alt="Logo Facturier"
            width={32}
            height={32}
            className="object-contain"
            priority
          />
        </div>

        {!collapsed && (
          <div className="min-w-0 flex-1 animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-foreground text-sm truncate">
                Facturier Hub
              </span>
              <span className="text-[9px] uppercase font-mono font-semibold px-1 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                v1.0
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
              <Sparkles className="h-2.5 w-2.5 text-primary shrink-0" />
              <span>Super Admin Cloud</span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation principale */}
      <nav className="flex-1 overflow-y-auto space-y-1 p-2.5">
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/admin"
              ? currentPath === "/admin"
              : currentPath.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onClick={() => setOptimisticPath(item.href)}
              onMouseDown={() => setOptimisticPath(item.href)}
              title={collapsed ? item.title : undefined}
              className={cn(
                "flex items-center rounded-xl text-xs font-medium transition-all group relative",
                collapsed
                  ? "justify-center h-10 w-full"
                  : "justify-between gap-3 px-3 py-2.5",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {!collapsed && (
                  <span className="truncate">{item.title}</span>
                )}
              </div>

              {!collapsed && item.badge && (
                <span className="px-1.5 py-0.2 text-[9px] font-mono font-semibold rounded bg-accent/10 text-accent border border-accent/20 shrink-0">
                  {item.badge}
                </span>
              )}

              {/* Indicateur actif discret en mode replié */}
              {collapsed && isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Pied de barre latérale : Session & Raccourci Déconnexion */}
      <div className="p-3 border-t border-border bg-card space-y-2">
        <div
          className={cn(
            "flex items-center rounded-xl bg-secondary/50 border border-border p-2",
            collapsed ? "justify-center" : "gap-3"
          )}
          title={collapsed ? userFullName || userEmail : undefined}
        >
          <div className="h-8 w-8 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
            <User className="h-4 w-4" />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">
                {userFullName || userEmail}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <ShieldCheck className="h-2.5 w-2.5 text-accent" />
                <span className="text-[10px] font-mono text-accent">
                  MFA {mfaLevel}
                </span>
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border border-border bg-secondary hover:bg-destructive/10 hover:border-destructive/30 text-destructive transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Se déconnecter
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
