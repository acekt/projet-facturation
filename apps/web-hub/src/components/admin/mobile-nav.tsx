"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, ShieldCheck, LogOut, Radio, User } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { ADMIN_NAV_ITEMS } from "./sidebar";

interface MobileNavProps {
  userEmail: string;
  userFullName?: string | null;
  mfaLevel?: string;
  logoutAction: () => Promise<void>;
}

export function MobileNav({
  userEmail,
  userFullName,
  mfaLevel = "AAL2",
  logoutAction,
}: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden">
      {/* Barre d'en-tête compacte pour mobile */}
      <div className="h-14 bg-card border-b border-border px-4 flex items-center justify-between sticky top-0 z-40 transition-colors">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="p-1.5 rounded-lg bg-secondary border border-border text-foreground hover:bg-secondary/80 focus:outline-none transition-colors"
            aria-label="Ouvrir le menu de navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/admin" className="flex items-center gap-2">
            <div className="relative h-7 w-7 rounded-lg bg-white dark:bg-card border border-border shadow-xs overflow-hidden shrink-0 flex items-center justify-center p-0.5">
              <Image
                src="/logo.png"
                alt="Logo Facturier"
                width={24}
                height={24}
                className="object-contain"
              />
            </div>
            <span className="font-bold text-xs text-foreground tracking-tight">Hub Super Admin</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-primary/10 border border-primary/20 text-primary font-mono">
            <Radio className="h-2.5 w-2.5 animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* Tiroir coulissant (Drawer) */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-72 max-w-[85vw] h-full bg-card border-r border-border flex flex-col p-4 space-y-4 animate-in slide-in-from-left duration-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête du tiroir */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="relative h-7 w-7 rounded-lg bg-white dark:bg-card border border-border shadow-xs overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                  <Image
                    src="/logo.png"
                    alt="Logo Facturier"
                    width={24}
                    height={24}
                    className="object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground">Hub Facturier</h3>
                  <p className="text-[10px] text-muted-foreground">Super Admin Console</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground"
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Liste des liens de navigation */}
            <nav className="flex-1 overflow-y-auto space-y-1 pr-1">
              {ADMIN_NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                      <span>{item.title}</span>
                    </div>
                    {item.badge && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-accent/10 text-accent border border-accent/20">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Pied du tiroir : Profil & Déconnexion */}
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {userFullName || userEmail}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono text-accent">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    MFA {mfaLevel}
                  </span>
                </div>
              </div>

              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-destructive/10 border border-border hover:border-destructive/30 text-xs text-destructive font-medium transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Se déconnecter
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
