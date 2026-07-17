"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sidebar, TopBar } from "@/components/layout/navigation"
import { CommandMenu } from "@/components/layout/command-menu"
import { Dashboard } from "@/components/pages/dashboard"
import { InvoicesPage } from "@/components/pages/invoices"
import { QuotesPage } from "@/components/pages/quotes"
import { QuoteEditor } from "@/components/pages/quote-editor"
import { InvoiceEditor } from "@/components/pages/invoice-editor"
import { ClientsPage } from "@/components/pages/clients"
import { ServicesPage } from "@/components/pages/services"
import { PaymentsPage } from "@/components/pages/payments"
import { SettingsPage } from "@/components/pages/settings"
import { CreditNotesPage } from "@/components/pages/credit-notes"
import { AuditLogsPage } from "@/components/pages/audit-logs"
import { UsersPage } from "@/components/pages/users"
import { UserEditor } from "@/components/pages/user-editor"
import { useStore } from "@/lib/store"
import { DataSync } from "@/components/data-sync"

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

interface ProtectedAppShellProps {
  initialUser: any
}

export function ProtectedAppShell({ initialUser }: ProtectedAppShellProps) {
  const user = useStore(state => state.user)
  const setUser = useStore(state => state.setUser)
  const isDataLoaded = useStore(state => state.isDataLoaded)

  // Synchronisation prioritaire (via useEffect uniquement) :
  // évite qu'un cache obsolète dans localStorage n'écrase le rôle réel de l'utilisateur connecté.
  // L'appel est déplacé dans useEffect pour ne pas déclencher de setState pendant le rendu
  // (ce qui causerait le warning "Cannot update a component while rendering a different component").
  React.useEffect(() => {
    if (initialUser && (!user || user.id !== initialUser.id || user.role !== initialUser.role)) {
      setUser(initialUser)
    }
  }, [initialUser, user, setUser])

  const [currentPage, setCurrentPage] = React.useState("dashboard")
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [commandOpen, setCommandOpen] = React.useState(false)

  // Raccourci clavier Cmd/Ctrl+K pour la palette de commandes
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const effectiveUser = initialUser || user

  if (!effectiveUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 animate-pulse" />
          <div className="w-24 h-2 bg-secondary rounded animate-pulse" />
        </div>
      </div>
    )
  }

  // Si l'utilisateur est connecté mais que les données SQLite sont en cours de chargement,
  // on monte l'ossature visuelle (Sidebar, TopBar) et on affiche le spinner uniquement au centre du contenu.
  if (!isDataLoaded) {
    return (
      <div className="h-screen bg-background overflow-hidden flex flex-col">
        <DataSync />
        <Sidebar
          currentPage={currentPage}
          onPageChange={() => {}} // Désactivé pendant le chargement
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <TopBar collapsed={sidebarCollapsed} onCommandOpen={() => {}} />
        <motion.main
          initial={false}
          animate={{ marginLeft: sidebarCollapsed ? 72 : 260 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="h-screen pt-16 flex flex-col overflow-hidden"
        >
          <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-background">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground font-medium">Initialisation des modules locaux...</p>
          </div>
        </motion.main>
      </div>
    )
  }

  const handlePageChange = (page: string) => {
    React.startTransition(() => {
      setCurrentPage(page)
    })
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard onNavigate={handlePageChange} />
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
      case "payments":
        return <PaymentsPage />
      case "credit-notes":
        return <CreditNotesPage />
      case "audit":
        return <AuditLogsPage />
      case "settings":
        return <SettingsPage />
      default:
        return <Dashboard onNavigate={handlePageChange} />
    }
  }

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      <DataSync />
      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onPageChange={handlePageChange}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Top Bar */}
      <TopBar collapsed={sidebarCollapsed} onCommandOpen={() => setCommandOpen(true)} />

      {/* Command Menu */}
      <CommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onNavigate={handlePageChange}
      />

      {/* Main Content */}
      <motion.main
        initial={false}
        animate={{ marginLeft: sidebarCollapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="h-screen pt-16 flex flex-col overflow-hidden"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex-1 flex flex-col overflow-hidden px-8 py-6"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </motion.main>
    </div>
  )
}
