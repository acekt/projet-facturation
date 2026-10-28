"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Barre de progression de navigation instantanée (0ms feedback)
 * ==============================================================
 * Inspirée des interfaces professionnelles (Linear, Stripe, Vercel).
 * Déclenche une ligne lumineuse haute performance en haut de l'écran dès le clic,
 * offrant un retour tactile immédiat avant même le retour du serveur.
 */
export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  // Réinitialisation dès que la nouvelle route est prête
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname, searchParams]);

  // Sécurité anti-blocage : réinitialisation automatique après 3,5s si aucune navigation n'aboutit
  useEffect(() => {
    if (!isNavigating) return;
    const safetyTimer = setTimeout(() => {
      setIsNavigating(false);
    }, 3500);
    return () => clearTimeout(safetyTimer);
  }, [isNavigating]);

  // Capture ultra-réactive des clics sur les liens internes
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      // Ignorer si clic molette, clic droit ou touches modificatrices (Cmd, Ctrl)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      const currentPath = window.location.pathname + window.location.search;
      if (href !== currentPath) {
        setIsNavigating(true);
      }
    };

    document.addEventListener("click", handleLinkClick, { capture: true });
    return () => document.removeEventListener("click", handleLinkClick, { capture: true });
  }, []);

  if (!isNavigating) return null;

  return (
    <aside
      aria-label="Progression du chargement"
      className="fixed top-0 left-0 right-0 z-50 h-[2.5px] bg-transparent pointer-events-none"
    >
      <div className="h-full bg-gradient-to-r from-primary via-accent to-primary shadow-xs shadow-primary/50 animate-nav-progress" />
    </aside>
  );
}
