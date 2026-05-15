"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sidebar, TopBar } from "@/components/layout/navigation"
import { CommandMenu } from "@/components/layout/command-menu"
import { Dashboard } from "@/components/pages/dashboard"
import { InvoicesPage } from "@/components/pages/invoices"
import { InvoiceEditor } from "@/components/pages/invoice-editor"
import { ClientsPage } from "@/components/pages/clients"
import { PaymentsPage } from "@/components/pages/payments"
import { SettingsPage } from "@/components/pages/settings"

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export default function App() {
  const [currentPage, setCurrentPage] = React.useState("dashboard")
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [commandOpen, setCommandOpen] = React.useState(false)

  const handlePageChange = (page: string) => {
    setCurrentPage(page)
  }

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

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />
      case "invoices":
        return <InvoicesPage onCreateInvoice={() => setCurrentPage("new-invoice")} />
      case "new-invoice":
        return <InvoiceEditor onBack={() => setCurrentPage("invoices")} />
      case "clients":
        return <ClientsPage />
      case "payments":
        return <PaymentsPage />
      case "settings":
        return <SettingsPage />
      default:
        return <Dashboard />
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
        className="pt-24 pb-8 px-8"
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
