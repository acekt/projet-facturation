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

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export default function App() {
  const { user, isDataLoaded } = useStore()
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

  // DataSync gère la redirection vers /login si non authentifié.
  // Pendant que Zustand hydrate depuis sessionStorage, user peut être null.
  // On affiche un skeleton minimaliste pour éviter le flash blanc et on attend la fin du chargement.
  if (!user || !isDataLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 animate-pulse" />
          <div className="w-24 h-2 bg-secondary rounded animate-pulse" />
        </div>
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
