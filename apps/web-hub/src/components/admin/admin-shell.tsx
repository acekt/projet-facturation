"use client";

import { useState } from "react";
import { CollapsibleSidebar } from "./collapsible-sidebar";
import { MobileNav } from "./mobile-nav";
import { AdminHeader } from "./header";
import { NavigationProgressBar } from "./navigation-progress";

interface AdminShellProps {
  children: React.ReactNode;
  user: {
    email: string;
    fullName?: string | null;
    aalLevel?: string;
  };
  logoutAction: () => Promise<void>;
}

export function AdminShell({
  children,
  user,
  logoutAction,
}: AdminShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col md:flex-row antialiased transition-colors">
      {/* Barre de chargement/progression instantanée (0ms feedback) */}
      <NavigationProgressBar />

      {/* Navigation mobile réactive pour smartphones et tablettes */}
      <MobileNav
        userEmail={user.email}
        userFullName={user.fullName}
        mfaLevel={user.aalLevel}
        logoutAction={logoutAction}
      />

      {/* Barre latérale desktop rétractable (72px <-> 256px) - Fixe et Statique */}
      <CollapsibleSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        userEmail={user.email}
        userFullName={user.fullName}
        mfaLevel={user.aalLevel}
        logoutAction={logoutAction}
      />

      {/* Zone de contenu principale : Header fixe + Main scrollable avec transition SPA */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header supérieur d'origine avec recherche ⌘K, breadcrumb, live status et ThemeToggle */}
        <AdminHeader
          user={user}
          logoutAction={logoutAction}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Corps de page défilant avec conteneur max-w-7xl centré */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-background transition-colors focus:outline-none">
          <div className="w-full max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
