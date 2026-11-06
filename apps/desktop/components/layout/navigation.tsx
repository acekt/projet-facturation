"use client"

import { logoutUser } from "@/app/actions/auth.actions"
import { supabaseSession } from "@/lib/auth/supabaseSession"
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
  LogOut,
  ScrollText,
  KeyRound,
  BookOpen,
  Package,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { isInvoicePendingPayment, isPendingQuote } from "@/lib/utils/counters"
import { useStore, type User } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
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

export { TopBar, type TopBarProps } from "./topbar"

export type NavGroup = 'pilotage' | 'sales' | 'repository' | 'admin' | 'bottom'

export interface NavItemConfig {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: string[]
  group: NavGroup
}

/**
 * Organisation de la navigation latérale selon la Loi de Miller (7±2 chunks) :
 * 1. PILOTAGE & TRÉSORERIE (Vision globale et flux financiers quotidiens)
 * 2. VENTES & DOCUMENTS (Cycle commercial et documents clients)
 * 3. RÉFÉRENTIEL (Données de base, fiches maîtres, catalogues et stocks)
 * 4. ADMINISTRATION & SÉCURITÉ (Gestion des accès et piste d'audit)
 * 5. PIED DE PAGE (Paramètres système et déconnexion sécurisée)
 */
export const navItems: NavItemConfig[] = [
  // 1. Pilotage & Trésorerie
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: ['admin', 'user'], group: 'pilotage' },
  { id: "ledger", label: "Livre des comptes", icon: BookOpen, roles: ['admin', 'user'], group: 'pilotage' },

  // 2. Ventes & Documents
  { id: "invoices", label: "Factures", icon: FileText, roles: ['admin', 'user'], group: 'sales' },
  { id: "quotes", label: "Devis", icon: FileText, roles: ['admin', 'user'], group: 'sales' },
  { id: "credit-notes", label: "Avoirs", icon: RefreshCcw, roles: ['admin', 'user'], group: 'sales' },

  // 3. Référentiel
  { id: "clients", label: "Clients", icon: Users, roles: ['admin', 'user'], group: 'repository' },
  { id: "services", label: "Services", icon: Briefcase, roles: ['admin', 'user'], group: 'repository' },
  { id: "stock", label: "Gestion de stock", icon: Package, roles: ['admin', 'user'], group: 'repository' },

  // 4. Administration & Sécurité
  { id: "users", label: "Utilisateurs", icon: KeyRound, roles: ['admin'], group: 'admin' },
  { id: "audit", label: "Journal d'audit", icon: ScrollText, roles: ['admin'], group: 'admin' },

  // 5. Pied de page
  { id: "settings", label: "Paramètres", icon: Settings, roles: ['admin', 'user'], group: 'bottom' },
]

interface SidebarProps {
  currentPage: string
  onPageChange: (page: string) => void
  collapsed: boolean
  onToggle: () => void
  user?: any
}

export function Sidebar({ currentPage, onPageChange, collapsed, onToggle, user: propUser }: SidebarProps) {
  const { user: storeUser, setUser, invoices, quotes, creditNotes, lowStockAlerts, refreshStockData } = useStore(
    useShallow((state) => ({
      user: state.user,
      setUser: state.setUser,
      invoices: state.invoices,
      quotes: state.quotes,
      creditNotes: state.creditNotes,
      lowStockAlerts: state.lowStockAlerts,
      refreshStockData: state.refreshStockData,
    }))
  )
  const user = propUser || storeUser
  const [showLogoutDialog, setShowLogoutDialog] = React.useState(false)
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)

  // Badges contextuels réactifs unifiés
  const unpaidCount = React.useMemo(
    () => invoices.filter((i) => isInvoicePendingPayment(i, creditNotes)).length,
    [invoices, creditNotes]
  )
  const pendingQuotesCount = React.useMemo(() => {
    // Badges Devis : exclut les devis expirés (EXPIRED), convertis et refusés via isPendingQuote
    return quotes.filter((q) => isPendingQuote(q)).length;
  }, [quotes])

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true)
    try {
      await supabaseSession.logout()
      await logoutUser()
      setUser(null)
      window.location.href = '/login'
    } catch (e) {
      console.warn("Erreur logout:", e)
      setUser(null)
      window.location.href = '/login'
    } finally {
      setIsLoggingOut(false)
      setShowLogoutDialog(false)
    }
  }

  const filteredItems = navItems.filter((item) => item.roles.includes(user?.role || 'user'))
  const pilotageItems = filteredItems.filter((i) => i.group === 'pilotage')
  const salesItems = filteredItems.filter((i) => i.group === 'sales')
  const repositoryItems = filteredItems.filter((i) => i.group === 'repository')
  const adminItems = filteredItems.filter((i) => i.group === 'admin')
  const bottomItems = filteredItems.filter((i) => i.group === 'bottom')

  const lowStockCount = lowStockAlerts.length;

  React.useEffect(() => {
    void refreshStockData(false);
  }, [refreshStockData]);

  const getItemBadge = (id: string): number | null => {
    if (id === 'invoices' && unpaidCount > 0) return unpaidCount
    if (id === 'quotes' && pendingQuotesCount > 0) return pendingQuotesCount
    if (id === 'stock' && lowStockCount > 0) return lowStockCount
    return null
  }

  const renderItem = (item: NavItemConfig) => {
    const badge = getItemBadge(item.id)

    return (
      <Tooltip key={item.id}>
        <TooltipTrigger asChild>
          <motion.button
            onClick={() => onPageChange(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all relative group cursor-pointer",
              currentPage === item.id
                ? "bg-primary/10 text-primary font-semibold"
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
              "w-5 h-5 relative z-10 transition-colors shrink-0",
              currentPage === item.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )} />
            <AnimatePresence>
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between overflow-hidden">
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    className="relative z-10 truncate"
                  >
                    {item.label}
                  </motion.span>
                  {badge !== null && (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={cn(
                        "ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full tabular-nums",
                        item.id === 'invoices'
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "bg-primary/15 text-primary"
                      )}
                    >
                      {badge}
                    </motion.span>
                  )}
                </div>
              )}
            </AnimatePresence>
          </motion.button>
        </TooltipTrigger>
        {collapsed && (
          <TooltipContent side="right">
            {item.label} {badge !== null ? `(${badge})` : ''}
          </TooltipContent>
        )}
      </Tooltip>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col z-50 shadow-sm"
      >
        {/* 1. Actions Rapides Métier (Loi de Fitts) */}
        <div className="p-3 space-y-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className={cn(
                  "w-full bg-primary hover:bg-primary-hover text-white transition-all shadow-sm cursor-pointer",
                  collapsed ? "justify-center px-2" : "justify-start gap-2"
                )}
                onClick={() => onPageChange("new-quote")}
              >
                <Plus className="w-4 h-4 shrink-0" />
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
                  "w-full border-primary/20 hover:bg-primary/10 text-primary transition-all shadow-sm cursor-pointer",
                  collapsed ? "justify-center px-2" : "justify-start gap-2"
                )}
                onClick={() => onPageChange("new-invoice")}
              >
                <Plus className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="text-sm font-medium">Nouvelle facture</span>}
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Nouvelle facture</TooltipContent>}
          </Tooltip>
        </div>

        {/* 2. Navigation groupée en 4 blocs cognitifs (Loi de Miller) */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
          {/* Groupe 1 : Pilotage & Trésorerie */}
          {pilotageItems.length > 0 && (
            <div className="space-y-1">
              {!collapsed && (
                <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Pilotage & Trésorerie
                </p>
              )}
              {pilotageItems.map(renderItem)}
            </div>
          )}

          {/* Groupe 2 : Ventes & Documents */}
          {salesItems.length > 0 && (
            <div className="space-y-1">
              {!collapsed && (
                <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Ventes & Documents
                </p>
              )}
              {salesItems.map(renderItem)}
            </div>
          )}

          {/* Groupe 3 : Référentiel */}
          {repositoryItems.length > 0 && (
            <div className="space-y-1">
              {!collapsed && (
                <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Référentiel
                </p>
              )}
              {repositoryItems.map(renderItem)}
            </div>
          )}

          {/* Groupe 4 : Administration & Sécurité */}
          {adminItems.length > 0 && (
            <div className="space-y-1">
              {!collapsed && (
                <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Administration & Sécurité
                </p>
              )}
              {adminItems.map(renderItem)}
            </div>
          )}
        </div>

        {/* 6. Pied de page (Footer) */}
        <div className="p-3 border-t border-border space-y-1">
          {bottomItems.map(renderItem)}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                onClick={() => setShowLogoutDialog(true)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all text-destructive hover:bg-destructive/10 cursor-pointer",
                  collapsed && "justify-center px-2"
                )}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <LogOut className="w-5 h-5 shrink-0 text-destructive" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      className="relative z-10 text-destructive font-medium"
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

        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-24 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shadow-sm z-50 cursor-pointer"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </motion.aside>

      {/* Confirmation de Déconnexion */}
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
                e.preventDefault()
                handleConfirmLogout()
              }}
              disabled={isLoggingOut}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
            >
              {isLoggingOut ? "Déconnexion..." : "Se déconnecter"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
