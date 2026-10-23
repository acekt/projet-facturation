"use client";

import { useState } from "react";
import { Radio, User, ShieldCheck, LogOut, ChevronDown } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette, CommandPaletteTrigger } from "./command-palette";
import { AdminBreadcrumb } from "./breadcrumb";

export interface AdminHeaderProps {
  user?: {
    email: string;
    fullName?: string | null;
    aalLevel?: string;
  };
  logoutAction?: () => Promise<void>;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function AdminHeader({ user, logoutAction }: AdminHeaderProps = {}) {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const userInitials = (user?.fullName || user?.email || "SA")
    .substring(0, 2)
    .toUpperCase();

  return (
    <>
      <header className="h-16 border-b border-border bg-card/80 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-40 transition-colors shadow-xs">
        {/* Section gauche : Fil d'Ariane contextuel */}
        <div className="flex items-center gap-3 min-w-0">
          <AdminBreadcrumb />
        </div>

        {/* Section centrale & droite : Recherche ⌘K + Status + ThemeToggle + Profil */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Déclencheur Palette de commande ⌘K */}
          <div className="w-44 sm:w-60 md:w-72">
            <CommandPaletteTrigger onClick={() => setIsCommandOpen(true)} />
          </div>

          <div className="w-px h-5 bg-border hidden sm:block" />

          {/* Badge Live Synchronisation */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent">
            <Radio className="h-3 w-3 text-accent animate-pulse" />
            <span className="text-[11px] font-medium font-mono">
              Hub Synchro Actif
            </span>
          </div>

          <div className="w-px h-5 bg-border hidden lg:block" />

          {/* Indicateur Isolation Tenant */}
          <span className="text-muted-foreground text-[11px] font-mono hidden xl:inline">
            Isolation: <span className="text-foreground font-semibold">Strict</span>
          </span>

          <div className="w-px h-5 bg-border hidden sm:block" />

          {/* Sélecteur de thème Clair / Sombre unifié */}
          <ThemeToggle />

          {/* Menu Profil utilisateur avec Avatar (si user fourni) */}
          {user && (
            <>
              <div className="w-px h-5 bg-border hidden sm:block" />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1 pl-1.5 rounded-full hover:bg-secondary border border-transparent hover:border-border transition-colors cursor-pointer group"
                  aria-label="Menu profil utilisateur Super Admin"
                >
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground font-extrabold text-xs flex items-center justify-center shadow-sm">
                    {userInitials}
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground hidden sm:block" />
                </button>

                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 rounded-xl bg-card border border-border shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-xs">
                      <div className="px-3 py-2 border-b border-border mb-1">
                        <p className="font-semibold text-foreground truncate">
                          {user.fullName || "Super Administrateur"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {user.email}
                        </p>
                        <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] bg-accent/10 text-accent border border-accent/20 font-mono">
                          <ShieldCheck className="h-2.5 w-2.5" />
                          Session MFA : {user.aalLevel || "AAL2"}
                        </div>
                      </div>

                      {logoutAction && (
                        <form action={logoutAction} className="pt-1">
                          <button
                            type="submit"
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors font-medium text-left cursor-pointer"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                            Se déconnecter du Hub
                          </button>
                        </form>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Palette de commande modale */}
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />
    </>
  );
}
