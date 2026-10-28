"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  Building2,
  Activity,
  DollarSign,
  TrendingUp,
  ShieldAlert,
  CreditCard,
  Radio,
  Plus,
  Send,
  Zap,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";

interface CommandItem {
  id: string;
  title: string;
  description: string;
  category: "Navigation" | "Actions Rapides" | "Sécurité & Supervision";
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const COMMAND_ITEMS: CommandItem[] = [
  // Navigation
  {
    id: "nav-overview",
    title: "Centre de Contrôle",
    description: "Vue d'ensemble des 6 KPIs clés et activité globale",
    category: "Navigation",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    id: "nav-tenants",
    title: "Tenants & Entreprises",
    description: "Annuaire des clients, statuts, bris de glace et suspensions",
    category: "Navigation",
    href: "/admin/tenants",
    icon: Building2,
  },
  {
    id: "nav-sync",
    title: "Parc & Synchronisation",
    description: "Supervision en direct de la flotte Desktop et calcul SLA p95",
    category: "Navigation",
    href: "/admin/sync",
    icon: Activity,
    badge: "Live",
  },
  {
    id: "nav-finance",
    title: "Finance & Volumes Facturés",
    description: "Consolidation du chiffre d'affaires, recouvrement et devis",
    category: "Navigation",
    href: "/admin/finance",
    icon: DollarSign,
  },
  {
    id: "nav-adoption",
    title: "Adoption & Funnel SaaS",
    description: "Funnel d'activation 4 étapes et radar de Health Score (0-100)",
    category: "Navigation",
    href: "/admin/adoption",
    icon: TrendingUp,
  },
  {
    id: "nav-security",
    title: "Piste d'Audit & Sécurité",
    description: "Journal immuable infalsifiable, conformité et traçabilité",
    category: "Navigation",
    href: "/admin/security",
    icon: ShieldAlert,
  },
  {
    id: "nav-licences",
    title: "Plans & Licences SaaS",
    description: "Catalogue d'abonnements, quotas et alertes d'expiration",
    category: "Navigation",
    href: "/admin/licences",
    icon: CreditCard,
  },
  {
    id: "nav-announcements",
    title: "Annonces & Alertes Globales",
    description: "Diffusion descendante vers Desktop et flux de résolution",
    category: "Navigation",
    href: "/admin/announcements",
    icon: Radio,
  },

  // Actions Rapides
  {
    id: "act-new-announcement",
    title: "Diffuser une nouvelle Annonce",
    description: "Créer un message broadcast (info, maintenance, sécurité)",
    category: "Actions Rapides",
    href: "/admin/announcements",
    icon: Send,
    badge: "Action",
  },
  {
    id: "act-new-plan",
    title: "Créer un nouveau Plan SaaS",
    description: "Définir un nouveau palier tarifaire avec quotas postes",
    category: "Actions Rapides",
    href: "/admin/licences",
    icon: Plus,
    badge: "Action",
  },
  {
    id: "act-fleet-health",
    title: "Vérifier la Santé de la Flotte",
    description: "Consulter les terminaux inactifs ou en erreur de synchro",
    category: "Actions Rapides",
    href: "/admin/sync",
    icon: Zap,
  },

  // Sécurité
  {
    id: "sec-break-glass",
    title: "Consulter les Accès Bris de Glace",
    description: "Vérifier les interventions d'urgence du Super Admin",
    category: "Sécurité & Supervision",
    href: "/admin/security?filter=BREAK_GLASS_ACCESS",
    icon: ShieldCheck,
  },
  {
    id: "sec-open-alerts",
    title: "Alertes Système Ouvertes",
    description: "Examiner les incidents non encore clôturés",
    category: "Sécurité & Supervision",
    href: "/admin/announcements",
    icon: CheckCircle2,
  },
];

export function CommandPaletteTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full max-w-md flex items-center justify-between gap-3 bg-secondary/60 hover:bg-secondary border border-border hover:border-primary/40 rounded-xl pl-3 pr-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-all group focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
      aria-label="Ouvrir la palette de commande rapide (Raccourci ⌘K ou Ctrl+K)"
    >
      <div className="flex items-center gap-2.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="text-muted-foreground font-normal">
          Rechercher un module, un client, une action...
        </span>
      </div>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono text-muted-foreground">
        <span className="text-[9px]">⌘</span>K
      </kbd>
    </button>
  );
}

interface CommandPaletteProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function CommandPalette({ isOpen: propIsOpen, onClose: propOnClose }: CommandPaletteProps = {}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean) => {
    setInternalIsOpen(open);
    if (!open && propOnClose) {
      propOnClose();
    }
  };

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Écoute du raccourci clavier global ⌘K ou Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(!isOpen);
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus automatique lors de l'ouverture
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filtrage des résultats
  const filteredItems = COMMAND_ITEMS.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // Préchargement proactif de la route sélectionnée
  useEffect(() => {
    const target = filteredItems[selectedIndex];
    if (isOpen && target?.href) {
      router.prefetch(target.href);
    }
  }, [isOpen, selectedIndex, filteredItems, router]);

  // Navigation au clavier dans les résultats
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredItems[selectedIndex];
      if (target) {
        handleSelect(target.href);
      }
    }
  };

  const handleSelect = (href: string) => {
    setIsOpen(false);
    startTransition(() => {
      router.push(href);
    });
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commande rapide Super Admin"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-start justify-center pt-16 md:pt-24 px-4 p-4 animate-in fade-in duration-150"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Champ de recherche principal */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
          <Search className="h-4 w-4 text-primary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Où souhaitez-vous aller ? Tapez une action ou un module..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd
            onClick={() => setIsOpen(false)}
            className="cursor-pointer px-2 py-0.5 rounded bg-muted border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            ÉCHAP
          </kbd>
        </div>

        {/* Liste des résultats par catégorie */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-border/40">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              <Search className="h-6 w-6 mx-auto mb-2 text-muted-foreground/60" />
              <p className="font-medium text-foreground">Aucun résultat trouvé pour "{query}"</p>
              <p className="mt-1 text-muted-foreground">Essayez des termes comme "tenants", "sync", "finance", "audit" ou "annonce".</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item, index) => {
                const isSelected = index === selectedIndex;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.href)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-xs transition-colors",
                      isSelected
                        ? "bg-primary/10 border border-primary/20 text-foreground font-medium"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "p-2 rounded-lg border transition-colors",
                          isSelected
                            ? "bg-primary/20 border-primary/30 text-primary"
                            : "bg-secondary border-border text-muted-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground truncate">
                            {item.title}
                          </span>
                          {item.badge && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase bg-primary/10 text-primary border border-primary/20">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="hidden sm:inline text-[10px] text-muted-foreground font-medium">
                        {item.category}
                      </span>
                      <ArrowRight
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          isSelected ? "translate-x-0.5 text-primary" : "text-muted-foreground/60"
                        )}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pied de palette d'aide aux raccourcis */}
        <div className="p-2.5 px-4 bg-muted/30 border-t border-border text-[10px] text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[9px]">↑</kbd>
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[9px]">↓</kbd> Naviguer
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[9px]">↵</kbd> Ouvrir
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[9px]">ESC</kbd> Quitter
            </span>
          </div>
          <span className="font-mono text-muted-foreground/70">Hub Facturier v1.0</span>
        </div>
      </div>
    </div>
  );
}
