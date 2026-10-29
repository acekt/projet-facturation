"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Search, Bell, Command, LogOut, KeyRound } from "lucide-react"
import { useStore, type User } from "@/lib/store"
import { logoutUser } from "@/app/actions/auth.actions"
import { supabaseSession } from "@/lib/auth/supabaseSession"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
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

export interface TopBarProps {
  collapsed: boolean
  onCommandOpen: () => void
  onOpenPasswordChange?: () => void
  user?: User | null
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
      await supabaseSession.logout()
      await logoutUser()
    } catch (e) {
      console.warn("Erreur logout:", e)
    }
    setUser(null)
    window.location.href = '/login'
  }

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
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all group cursor-pointer"
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
          <button className="relative p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-transparent hover:border-border cursor-pointer">
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

      {/* Confirmation Popup de Déconnexion TopBar */}
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

