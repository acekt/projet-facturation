"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FileText } from "lucide-react"
import { Sidebar, TopBar } from "@/components/layout/navigation"
import { CommandMenu } from "@/components/layout/command-menu"
import { ForcePasswordChangeDialog } from "@/components/auth/force-password-change-dialog"
import { Dashboard } from "@/components/pages/dashboard"
import { InvoicesPage } from "@/components/pages/invoices"
import { QuotesPage } from "@/components/pages/quotes"
import { QuoteEditor } from "@/components/pages/quote-editor"
import { InvoiceEditor } from "@/components/pages/invoice-editor"
import { ClientsPage } from "@/components/pages/clients"
import { ServicesPage } from "@/components/pages/services"
import { SettingsPage } from "@/components/pages/settings"
import { CreditNotesPage } from "@/components/pages/credit-notes"
import { AuditLogsPage } from "@/components/pages/audit-logs"
import { UsersPage } from "@/components/pages/users"
import { UserEditor } from "@/components/pages/user-editor"
import { useStore } from "@/lib/store"
import { DataSync } from "@/components/data-sync"
import { CloudSyncRunner } from "@/components/cloud-sync-runner"
import type { UserResponse } from "@/lib/types/api"

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

const ADMIN_ONLY_PAGES = new Set(["users", "new-user", "edit-user", "audit"])

interface ProtectedAppShellProps {
  initialUser: UserResponse
}

export function ProtectedAppShell({ initialUser }: ProtectedAppShellProps) {
  const user = useStore(state => state.user)
  const setUser = useStore(state => state.setUser)
  const isDataLoaded = useStore(state => state.isDataLoaded)

  // Synchronisation prioritaire du store avec l'utilisateur validé par le Server Component
  React.useEffect(() => {
    if (initialUser) {
      const state = useStore.getState();
      if (
        !state.user ||
        state.user.id !== initialUser.id ||
        state.user.role !== initialUser.role ||
        state.user.force_password_change !== initialUser.force_password_change
      ) {
        setUser(initialUser);
      }
    }
  }, [initialUser, setUser]);

  const [currentPage, setCurrentPage] = React.useState("dashboard")
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [commandOpen, setCommandOpen] = React.useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false)

  // L'utilisateur du store est prioritaire après hydratation pour refléter en temps réel force_password_change = 0
  const effectiveUser = user || initialUser
  const isMandatoryPasswordChange = Boolean(
    effectiveUser &&
      (effectiveUser.force_password_change === 1 || effectiveUser.force_password_change === true)
  )

  // Raccourci clavier Cmd/Ctrl+K pour la palette de commandes (désactivé si changement de mot de passe requis)
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isMandatoryPasswordChange) return
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [isMandatoryPasswordChange])

  const handlePageChange = React.useCallback(
    (page: string) => {
      if (effectiveUser?.role !== "admin" && ADMIN_ONLY_PAGES.has(page)) {
        return
      }
      React.startTransition(() => {
        setCurrentPage(page)
      })
    },
    [effectiveUser?.role]
  )

  const renderPage = React.useCallback(() => {
    // Protection RBAC stricte sur les vues réservées à l'Administrateur
    if (effectiveUser?.role !== "admin" && ADMIN_ONLY_PAGES.has(currentPage)) {
      return <Dashboard onNavigate={handlePageChange} user={effectiveUser} />
    }

    switch (currentPage) {
      case "dashboard":
        return <Dashboard onNavigate={handlePageChange} user={effectiveUser} />
      case "users":
        return <UsersPage 
          onCreateUser={() => {
            setEditingId(null);
            setCurrentPage("new-user");
          }}
          onEditUser={(id: string) => {
            setEditingId(id);
            setCurrentPage("edit-user");
          }}
        />
      case "new-user":
        return <UserEditor
          onBack={() => {
            setEditingId(null);
            setCurrentPage("users");
          }}
          editingId={null}
        />
      case "edit-user":
        return <UserEditor
          onBack={() => {
            setEditingId(null);
            setCurrentPage("users");
          }}
          editingId={editingId}
        />
      case "quotes":
        return <QuotesPage onCreateQuote={(id) => {
          setEditingId(id || null);
          setCurrentPage("new-quote");
        }} />
      case "new-quote":
        return <QuoteEditor
          onBack={() => {
            setEditingId(null);
            setCurrentPage("quotes");
          }}
          editingId={editingId}
        />
      case "invoices":
        return <InvoicesPage 
          onCreateInvoice={() => {
            setEditingId(null);
            handlePageChange("new-invoice");
          }} 
          onEditInvoice={(id) => {
            setEditingId(id);
            handlePageChange("edit-invoice");
          }} 
        />
      case "new-invoice":
        return <InvoiceEditor
          onBack={() => {
            setEditingId(null);
            handlePageChange("invoices");
          }}
          editingId={null}
        />
      case "edit-invoice":
        return <InvoiceEditor
          onBack={() => {
            setEditingId(null);
            handlePageChange("invoices");
          }}
          editingId={editingId}
        />
      case "clients":
        return <ClientsPage />
      case "services":
        return <ServicesPage />
      case "credit-notes":
        return <CreditNotesPage />
      case "audit":
        return <AuditLogsPage />
      case "settings":
        return <SettingsPage />
      default:
        return <Dashboard onNavigate={handlePageChange} user={effectiveUser} />
    }
  }, [currentPage, handlePageChange, editingId, effectiveUser])

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      <DataSync />
      <CloudSyncRunner />
      {/* Portail de changement de mot de passe obligatoire ou volontaire */}
      <ForcePasswordChangeDialog
        open={isMandatoryPasswordChange || passwordDialogOpen}
        isMandatory={isMandatoryPasswordChange}
        onOpenChange={setPasswordDialogOpen}
      />
      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onPageChange={handlePageChange}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        user={effectiveUser}
      />
      {/* Top Bar */}
      <TopBar 
        collapsed={sidebarCollapsed} 
        onCommandOpen={() => !isMandatoryPasswordChange && setCommandOpen(true)} 
        onOpenPasswordChange={() => setPasswordDialogOpen(true)}
        user={effectiveUser}
      />
      {/* Command Menu */}
      <CommandMenu
        open={commandOpen && !isMandatoryPasswordChange}
        onOpenChange={setCommandOpen}
        onNavigate={handlePageChange}
      />
      {/* Main Content */}
      <motion.main
        initial={false}
        animate={{ marginLeft: sidebarCollapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="h-screen pt-16 flex flex-col overflow-hidden relative"
      >
        <AnimatePresence mode="wait">
          {!effectiveUser || !isDataLoaded ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.4 } }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md z-[100]"
              role="status"
              aria-live="polite"
            >
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-primary/20 rounded-full"></div>
                <div className="absolute w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <FileText className="absolute w-6 h-6 text-primary animate-pulse" />
              </div>
              <p className="mt-6 text-sm text-muted-foreground font-medium animate-pulse">
                Initialisation de Facturier... Veuillez patienter
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={currentPage}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="flex-1 flex flex-col overflow-hidden px-8 py-6 h-full relative"
            >
              {renderPage()}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>
    </div>
  )
}
