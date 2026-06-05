"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sidebar, TopBar } from "@/components/layout/navigation"
import { CommandMenu } from "@/components/layout/command-menu"
import { Dashboard } from "@/components/pages/dashboard"
import { InvoicesPage } from "@/components/pages/invoices"
import { QuotesPage } from "@/components/pages/quotes"
import { QuoteEditor } from "@/components/pages/quote-editor"
import { ClientsPage } from "@/components/pages/clients"
import { ServicesPage } from "@/components/pages/services"
import { PaymentsPage } from "@/components/pages/payments"
import { SettingsPage } from "@/components/pages/settings"
import { CreditNotesPage } from "@/components/pages/credit-notes"
import { AuditLogsPage } from "@/components/pages/audit-logs"
import { UsersPage } from "@/components/pages/users"
import { UserEditor } from "@/components/pages/user-editor"
import { useStore } from "@/lib/store"
import { useRouter } from "next/navigation"

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export default function App() {
  const router = useRouter()
  const { user, setUser } = useStore()
  const [currentPage, setCurrentPage] = React.useState("dashboard")
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [commandOpen, setCommandOpen] = React.useState(false)
  const [isClient, setIsClient] = React.useState(false)
  const [isLoadingSession, setIsLoadingSession] = React.useState(true)

  React.useEffect(() => {
    setIsClient(true)
  }, [])

  React.useEffect(() => {
    // Fetch user session on mount
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
        }
      } catch (error) {
        console.error('Failed to fetch session:', error)
      } finally {
        setIsLoadingSession(false)
      }
    }

    if (isClient) {
      fetchSession()
    }
  }, [isClient, setUser])

  React.useEffect(() => {
    if (isClient && !isLoadingSession && !user) {
      router.push('/login')
    }
  }, [user, router, isClient, isLoadingSession])

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

  if (!isClient) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    )
  }

  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Vérification de la session...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Redirection vers la connexion...</div>
      </div>
    )
  }

  const handlePageChange = (page: string) => {
    setCurrentPage(page)
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
        return <InvoicesPage onCreateInvoice={() => {}} onEditInvoice={() => {}} />
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
    <div className="min-h-screen bg-background">
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
        className="pt-20 px-8 pb-8"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </motion.main>
    </div>
  )
}
