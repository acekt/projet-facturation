"use client"

import { logoutUser } from "@/app/actions/auth.actions"
import { connector } from "@/lib/powersync"
import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  FileText,
  Users,
  Briefcase,
  RefreshCcw,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Bell,
  Command,
  LogOut,
  ScrollText,
  KeyRound,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { Button } from "@workspace/ui/components/button"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"

interface SidebarProps {
  currentPage: string
  onPageChange: (page: string) => void
  collapsed: boolean
  onToggle: () => void
  user?: any
}

export const navItems = [
  // Groupe Système
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: ['admin', 'user'], group: 'system' },
  { id: "users", label: "Utilisateurs", icon: Users, roles: ['admin'], group: 'system' },
  { id: "audit", label: "Journal Audit", icon: ScrollText, roles: ['admin'], group: 'system' },

  // Groupe Référentiel (Consultation pour Opérateur, Gestion complète pour Admin)
  { id: "clients", label: "Clients", icon: Users, roles: ['admin', 'user'], group: 'repository' },
  { id: "services", label: "Services", icon: Briefcase, roles: ['admin', 'user'], group: 'repository' },

  // Groupe Opérations
  { id: "quotes", label: "Devis", icon: FileText, roles: ['admin', 'user'], group: 'business' },
  { id: "invoices", label: "Factures", icon: FileText, roles: ['admin', 'user'], group: 'business' },
  { id: "credit-notes", label: "Avoirs", icon: RefreshCcw, roles: ['admin', 'user'], group: 'business' },

  // Bas de Sidebar (Consultation pour Opérateur, Modification pour Admin)
  { id: "settings", label: "Paramètres", icon: Settings, roles: ['admin', 'user'], group: 'bottom' },
]

export function Sidebar({ currentPage, onPageChange, collapsed, onToggle, user: propUser }: SidebarProps) {
  const storeUser = useStore((state) => state.user)
  const user = propUser || storeUser
  const setUser = useStore((state) => state.setUser)
  const [showLogoutDialog, setShowLogoutDialog] = React.useState(false)
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true)
    try {
      await connector.logout();
      await logoutUser();
    } catch (e) {
      console.warn("Erreur logout:", e);
    }
    setUser(null);
    window.location.href = '/login';
  };

  const filteredItems = navItems.filter(item => item.roles.includes(user?.role || 'user'));
  const systemItems = filteredItems.filter(i => i.group === 'system');
  const repositoryItems = filteredItems.filter(i => i.group === 'repository');
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
        {/* Action Buttons (Admin & Operator) */}
        {(user?.role === 'user' || user?.role === 'admin') && (
          <div className="p-3 space-y-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className={cn(
                    "w-full bg-primary hover:bg-primary-hover text-white transition-all shadow-sm",
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full border-indigo-500/20 hover:bg-indigo-500 hover:text-white text-indigo-500 transition-all shadow-sm",
                    collapsed ? "justify-center px-2" : "justify-start gap-2"
                  )}
                  onClick={() => onPageChange("new-invoice")}
                >
                  <Plus className="w-4 h-4" />
                  {!collapsed && <span className="text-sm font-medium">Nouvelle facture</span>}
                </Button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Nouvelle facture</TooltipContent>}
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

          {/* Groupe Référentiel */}
          {repositoryItems.length > 0 && (
            <div className="space-y-1">
              {!collapsed && <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Référentiel</p>}
              {repositoryItems.map(renderItem)}
            </div>
          )}

          {/* Groupe Opérations */}
          {businessItems.length > 0 && (
            <div className="space-y-1">
              {!collapsed && <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Opérations</p>}
              {businessItems.map(renderItem)}
            </div>
          )}
        </div>

        {/* Bottom Section */}
        <div className="p-3 border-t border-border space-y-2">
          <div className="space-y-1">
            {bottomItems.map(renderItem)}
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  onClick={() => setShowLogoutDialog(true)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-destructive hover:bg-destructive/10",
                    collapsed && "justify-center px-2"
                  )}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="relative z-10"
                      >
                        Déconnexion
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Déconnexion</TooltipContent>}
            </Tooltip>
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

      {/* Confirmation Popup de Déconnexion Sidebar */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmer la déconnexion</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir vous déconnecter de l'application Facturier ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmLogout();
              }}
              disabled={isLoggingOut}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoggingOut ? "Déconnexion..." : "Se déconnecter"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}

interface TopBarProps {
  collapsed: boolean
  onCommandOpen: () => void
  onOpenPasswordChange?: () => void
  user?: any
}

export function TopBar({ collapsed, onCommandOpen, onOpenPasswordChange, user: propUser }: TopBarProps) {
  const storeUser = useStore((state) => state.user)
  const user = propUser || storeUser
  const setUser = useStore((state) => state.setUser)
  const [showLogoutDialog, setShowLogoutDialog] = React.useState(false)
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true)
    try {
      await connector.logout();
      await logoutUser();
    } catch (e) {
      console.warn("Erreur logout:", e);
    }
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <>
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

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button className="relative p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-transparent hover:border-border">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-background" />
          </button>

          <div className="w-px h-8 bg-border mx-2" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 hover:bg-secondary/50 p-1.5 pr-2 rounded-full transition-colors text-left outline-none cursor-pointer">
                <div className="hidden sm:flex flex-col items-end">
                  <p className="text-sm font-bold text-foreground leading-none">{user?.name || 'Utilisateur'}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                    {user?.role === 'admin' ? 'Administrateur' : 'Opérateur'}
                  </p>
                </div>
                <Avatar className="w-9 h-9 ring-2 ring-background bg-secondary">
                  <AvatarFallback className="bg-primary/10 text-primary font-extrabold text-sm">
                    {user?.name?.substring(0, 2).toUpperCase() || 'AD'}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => onOpenPasswordChange?.()} className="cursor-pointer">
                <KeyRound className="w-4 h-4 mr-2" />
                Changer mon mot de passe
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowLogoutDialog(true)} className="text-destructive cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.header>

      {/* Confirmation Popup de Déconnexion */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmer la déconnexion</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir vous déconnecter de l'application Facturier ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmLogout();
              }}
              disabled={isLoggingOut}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoggingOut ? "Déconnexion..." : "Se déconnecter"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
