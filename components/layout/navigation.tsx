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
} from "lucide-react"
import { cn } from "@/lib/utils"
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
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "quotes", label: "Devis", icon: FileText },
  { id: "invoices", label: "Factures", icon: FileText },
  { id: "clients", label: "Clients", icon: Users },
  { id: "services", label: "Services", icon: Briefcase },
  { id: "payments", label: "Paiements", icon: CreditCard },
  { id: "credit-notes", label: "Avoirs", icon: RefreshCcw },
  { id: "settings", label: "Parametres", icon: Settings },
]

export function Sidebar({ currentPage, onPageChange, collapsed, onToggle }: SidebarProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col z-50 shadow-sm"
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-border">
          <motion.div
            className="flex items-center gap-3"
            animate={{ justifyContent: collapsed ? "center" : "flex-start" }}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Star className="w-5 h-5 text-white" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex flex-col"
                >
                  <span className="font-bold text-foreground tracking-tight text-lg">
                    L&apos;Etoile
                  </span>
                  <span className="text-xs text-muted-foreground -mt-0.5">Facturation Pro</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <div className="p-3 space-y-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full border-primary/20 hover:bg-primary/5 text-primary transition-all",
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
                className={cn(
                  "w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 transition-all",
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

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => (
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
          ))}
        </nav>

        {/* User Section */}
        <div className="p-3 border-t border-border">
          <div className={cn(
            "flex items-center gap-3 p-2 rounded-xl hover:bg-secondary cursor-pointer transition-colors",
            collapsed && "justify-center"
          )}>
            <Avatar className="w-9 h-9 ring-2 ring-border">
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-medium">
                ADM
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">Administrateur</p>
                <p className="text-xs text-muted-foreground truncate">Session Locale</p>
              </div>
            )}
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shadow-sm"
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
