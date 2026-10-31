"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2 } from "lucide-react"
import { Sidebar, TopBar } from "@/components/layout/navigation"
import { CommandMenu } from "@/components/layout/command-menu"
import { ForcePasswordChangeDialog } from "@/components/auth/force-password-change-dialog"
import { Dashboard } from "@/components/pages/dashboard"
import { useStore } from "@/lib/store"
import { DataSync } from "@/components/data-sync"
import { CloudSyncRunner } from "@/components/cloud-sync-runner"
import { AnnouncementBanner } from "@/components/layout/announcement-banner"
import type { UserResponse } from "@/lib/types/api"

const PageLoadingFallback = () => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
    <Loader2 className="w-8 h-8 text-primary animate-spin" />
    <span className="mt-3 text-xs text-muted-foreground font-medium">Chargement du module...</span>
  </div>
)

const InvoicesPage = dynamic(() => import("@/components/pages/invoices").then((m) => m.InvoicesPage), { loading: () => <PageLoadingFallback />, ssr: false })
const QuotesPage = dynamic(() => import("@/components/pages/quotes").then((m) => m.QuotesPage), { loading: () => <PageLoadingFallback />, ssr: false })
const QuoteEditor = dynamic(() => import("@/components/pages/quote-editor").then((m) => m.QuoteEditor), { loading: () => <PageLoadingFallback />, ssr: false })
const InvoiceEditor = dynamic(() => import("@/components/pages/invoice-editor").then((m) => m.InvoiceEditor), { loading: () => <PageLoadingFallback />, ssr: false })
const ClientsPage = dynamic(() => import("@/components/pages/clients").then((m) => m.ClientsPage), { loading: () => <PageLoadingFallback />, ssr: false })
const ServicesPage = dynamic(() => import("@/components/pages/services").then((m) => m.ServicesPage), { loading: () => <PageLoadingFallback />, ssr: false })
const SettingsPage = dynamic(() => import("@/components/pages/settings").then((m) => m.SettingsPage), { loading: () => <PageLoadingFallback />, ssr: false })
const CreditNotesPage = dynamic(() => import("@/components/pages/credit-notes").then((m) => m.CreditNotesPage), { loading: () => <PageLoadingFallback />, ssr: false })
const AuditLogsPage = dynamic(() => import("@/components/pages/audit-logs").then((m) => m.AuditLogsPage), { loading: () => <PageLoadingFallback />, ssr: false })
const UsersPage = dynamic(() => import("@/components/pages/users").then((m) => m.UsersPage), { loading: () => <PageLoadingFallback />, ssr: false })
const UserEditor = dynamic(() => import("@/components/pages/user-editor").then((m) => m.UserEditor), { loading: () => <PageLoadingFallback />, ssr: false })

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

  // Signal de transition fluide depuis le splash screen Electron
  React.useEffect(() => {
    window.electron?.reportAppReady?.();
  }, []);

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
        <AnnouncementBanner />
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="flex-1 flex flex-col overflow-hidden px-8 py-6 h-full relative"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </motion.main>
    </div>
  )
}
