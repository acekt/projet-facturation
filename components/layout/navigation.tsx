"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  FileText,
  Users,
  Briefcase,
  CreditCard,
  RefreshCcw,
  Settings,
  ChevronLeft,
  ChevronRight,
  Star,
  Plus,
  Search,
  Bell,
  Command,
  LogOut,
  BarChart3,
  ScrollText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ThemeToggle } from "@/components/theme-toggle"

interface SidebarProps {
  currentPage: string
  onPageChange: (page: string) => void
  collapsed: boolean
  onToggle: () => void
}

const navItems = [
  // Groupe Système
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: ['admin', 'user'], group: 'system' },
  { id: "analytics", label: "Statistiques", icon: BarChart3, roles: ['admin', 'user'], group: 'system' },
  { id: "users", label: "Utilisateurs", icon: Users, roles: ['admin'], group: 'system' },
  { id: "audit", label: "Journal Audit", icon: ScrollText, roles: ['admin'], group: 'system' },

  // Groupe Opérations
  { id: "clients", label: "Clients", icon: Users, roles: ['user'], group: 'business' },
  { id: "quotes", label: "Devis", icon: FileText, roles: ['user'], group: 'business' },
  { id: "invoices", label: "Factures", icon: FileText, roles: ['user'], group: 'business' },
  { id: "services", label: "Services", icon: Briefcase, roles: ['user'], group: 'business' },
  { id: "payments", label: "Paiements", icon: CreditCard, roles: ['user'], group: 'business' },
  { id: "credit-notes", label: "Avoirs", icon: RefreshCcw, roles: ['user'], group: 'business' },

  // Bas de Sidebar
  { id: "settings", label: "Paramètres", icon: Settings, roles: ['admin', 'user'], group: 'bottom' },
]

export function Sidebar({ currentPage, onPageChange, collapsed, onToggle }: SidebarProps) {
  const user = useStore((state) => state.user)
  const setUser = useStore((state) => state.setUser)
  const router = useRouter()

  const handleLogout = async () => {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    setUser(null);
    router.push('/login');
  };

  const filteredItems = navItems.filter(item => item.roles.includes(user?.role || 'user'));
  const systemItems = filteredItems.filter(i => i.group === 'system');
  const businessItems = filteredItems.filter(i => i.group === 'business');
  const bottomItems = filteredItems.filter(i => i.group === 'bottom');

  const renderItem = (item: typeof navItems[0]) => (
    <Tooltip key={item.id}>
      <TooltipTrigger asChild>
        <motion.button
          onClick={() => onPageChange(item.id)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative group",
            currentPage === item.id
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary",
            collapsed && "justify-center px-2"
          )}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
        >
          {currentPage === item.id && (
            <motion.div
              layoutId="activeNav"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <item.icon className={cn(
            "w-5 h-5 relative z-10 transition-colors",
            currentPage === item.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          )} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="relative z-10"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col z-50 shadow-sm"
      >
        {/* Logo Section */}
        <div className="h-20 flex flex-col justify-center px-4 border-b border-border">
          <motion.div
            className="flex items-center gap-3"
            animate={{ justifyContent: collapsed ? "center" : "flex-start" }}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Star className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-foreground tracking-tight text-lg">L'ÉTOILE</span>
                <span className={cn(
                    "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded w-fit",
                    user?.role === 'admin' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                )}>
                    {user?.role === 'admin' ? "Administration" : "Opérations"}
                </span>
              </div>
            )}
          </motion.div>
        </div>

        {/* Action Button (User Only) */}
        {user?.role === 'user' && (
          <div className="p-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full border-primary/20 hover:bg-primary hover:text-primary-foreground text-primary transition-all shadow-sm",
                    collapsed ? "justify-center px-2" : "justify-start gap-2"
                  )}
                  onClick={() => onPageChange("new-quote")}
                >
                  <Plus className="w-4 h-4" />
                  {!collapsed && <span className="text-sm font-medium">Nouveau devis</span>}
                </Button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Nouveau devis</TooltipContent>}
            </Tooltip>
          </div>
        )}

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
          {/* Groupe Système */}
          <div className="space-y-1">
            {!collapsed && <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Système</p>}
            {systemItems.map(renderItem)}
          </div>

          {/* Groupe Opérations */}
          {businessItems.length > 0 && (
            <div className="space-y-1">
              {!collapsed && <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Opérations</p>}
              {businessItems.map(renderItem)}
            </div>
          )}
        </div>

        {/* Bottom Section */}
        <div className="p-3 border-t border-border space-y-3">
          <div className="space-y-1">
            {bottomItems.map(renderItem)}
          </div>

          <div className={cn(
            "flex items-center gap-3 p-2 rounded-xl bg-secondary/50",
            collapsed && "justify-center"
          )}>
            <Avatar className="w-9 h-9 ring-2 ring-background">
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-medium">
                {user?.name?.substring(0, 2).toUpperCase() || 'AD'}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{user?.name || 'Utilisateur'}</p>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors mt-0.5"
                >
                    <LogOut className="w-3 h-3" />
                    Déconnexion
                </button>
              </div>
            )}
            {collapsed && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Déconnexion</TooltipContent>
                </Tooltip>
            )}
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-24 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shadow-sm z-50"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </motion.aside>
    </TooltipProvider>
  )
}

interface TopBarProps {
  collapsed: boolean
  onCommandOpen: () => void
}

export function TopBar({ collapsed, onCommandOpen }: TopBarProps) {
  return (
    <motion.header
      initial={false}
      animate={{ marginLeft: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="fixed top-0 right-0 h-16 bg-background/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-6 z-40"
      style={{ left: 0 }}
    >
      <button
        onClick={onCommandOpen}
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all group"
      >
        <Search className="w-4 h-4" />
        <span className="text-sm">Rechercher...</span>
        <div className="flex items-center gap-1 ml-4">
          <kbd className="px-1.5 py-0.5 text-xs rounded bg-muted border border-border font-mono">
            <Command className="w-3 h-3 inline" />
          </kbd>
          <kbd className="px-1.5 py-0.5 text-xs rounded bg-muted border border-border font-mono">K</kbd>
        </div>
      </button>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <button className="relative p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-transparent hover:border-border">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary ring-2 ring-background" />
        </button>
      </div>
    </motion.header>
  )
}
