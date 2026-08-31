"use client"

import * as React from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  FileText,
  Users,
  Plus,
  LayoutDashboard,
  CreditCard,
  Settings,
  Briefcase,
  RefreshCcw,
  Search,
  BarChart3,
  ScrollText,
} from "lucide-react"
import { useStore } from "@/lib/store"

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (page: string) => void
}

// ── Source de vérité RBAC — alignée sur navigation.tsx ────────────────────────
const quickActions = [
  { id: "new-quote", label: "Nouveau devis", description: "Créer un nouveau devis", icon: Plus, iconBg: "bg-blue-500/10", iconColor: "text-blue-500", roles: ['user'] },
  { id: "new-invoice", label: "Nouvelle facture", description: "Créer une nouvelle facture", icon: Plus, iconBg: "bg-indigo-500/10", iconColor: "text-indigo-500", roles: ['user'] },
  { id: "clients", label: "Nouveau client", description: "Ajouter un client", icon: Users, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-500", roles: ['admin'] },
  { id: "services", label: "Nouveau service", description: "Ajouter un service", icon: Briefcase, iconBg: "bg-amber-500/10", iconColor: "text-amber-500", roles: ['admin'] },
  { id: "users", label: "Nouvel utilisateur", description: "Ajouter un utilisateur", icon: Users, iconBg: "bg-purple-500/10", iconColor: "text-purple-500", roles: ['admin'] },
]

const navItems = [
  // Système
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: ['admin', 'user'] },
  { id: "users", label: "Utilisateurs", icon: Users, roles: ['admin'] },
  { id: "audit", label: "Journal Audit", icon: ScrollText, roles: ['admin'] },
  // Référentiel
  { id: "clients", label: "Clients", icon: Users, roles: ['admin'] },
  { id: "services", label: "Services", icon: Briefcase, roles: ['admin'] },
  // Opérations
  { id: "quotes", label: "Devis", icon: FileText, roles: ['admin', 'user'] },
  { id: "invoices", label: "Factures", icon: FileText, roles: ['admin', 'user'] },
  { id: "payments", label: "Paiements", icon: CreditCard, roles: ['admin', 'user'] },
  { id: "credit-notes", label: "Avoirs", icon: RefreshCcw, roles: ['admin', 'user'] },
  // Bottom
  { id: "settings", label: "Paramètres", icon: Settings, roles: ['admin', 'user'] },
]

export function CommandMenu({ open, onOpenChange, onNavigate }: CommandMenuProps) {
  const invoices = useStore((state) => state.invoices)
  const clients = useStore((state) => state.clients)
  const services = useStore((state) => state.services)
  const user = useStore((state) => state.user)
  const [search, setSearch] = React.useState("")

  const role = user?.role || 'user'

  const handleSelect = (page: string) => {
    onNavigate(page)
    onOpenChange(false)
    setSearch("")
  }

  // Filtrage RBAC dynamique
  const visibleQuickActions = quickActions.filter(a => a.roles.includes(role))
  const visibleNavItems = navItems.filter(n => n.roles.includes(role))

  const filteredInvoices = invoices.filter(i =>
    i.number.toLowerCase().includes(search.toLowerCase()) ||
    i.clientName.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 5)

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 5)

  const filteredServices = services.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 5)

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Rechercher une action, une facture, un client..." 
        className="border-b border-border"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>Aucun résultat trouvé pour "{search}".</CommandEmpty>
        
        {visibleQuickActions.length > 0 && (
          <CommandGroup heading="Actions rapides">
            {visibleQuickActions.map((action) => (
              <CommandItem key={action.id} onSelect={() => handleSelect(action.id)} className="gap-3 py-3 cursor-pointer">
                <div className={`w-8 h-8 rounded-lg ${action.iconBg} flex items-center justify-center`}>
                  <action.icon className={`w-4 h-4 ${action.iconColor}`} />
                </div>
                <div>
                  <p className="font-medium text-foreground">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          {visibleNavItems.map((item) => (
            <CommandItem key={item.id} onSelect={() => handleSelect(item.id)} className="gap-3 py-2 cursor-pointer">
              <item.icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Recherche contextuelle : Factures */}
        {filteredInvoices.length > 0 && (
          <CommandGroup heading="Factures">
            {filteredInvoices.map((invoice) => (
              <CommandItem key={invoice.id} onSelect={() => handleSelect("invoices")} className="gap-3 py-2 cursor-pointer">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-foreground">{invoice.number}</span>
                  <span className="text-xs text-muted-foreground">{invoice.clientName}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Recherche contextuelle : Clients (admin uniquement) */}
        {role === 'admin' && filteredClients.length > 0 && (
          <CommandGroup heading="Clients">
            {filteredClients.map((client) => (
              <CommandItem key={client.id} onSelect={() => handleSelect("clients")} className="gap-3 py-2 cursor-pointer">
                <Users className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-foreground">{client.name}</span>
                  <span className="text-xs text-muted-foreground">{client.email}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Recherche contextuelle : Services (admin uniquement) */}
        {role === 'admin' && filteredServices.length > 0 && (
          <CommandGroup heading="Services">
            {filteredServices.map((service) => (
              <CommandItem key={service.id} onSelect={() => handleSelect("services")} className="gap-3 py-2 cursor-pointer">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-foreground">{service.name}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
