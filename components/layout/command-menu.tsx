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

export function CommandMenu({ open, onOpenChange, onNavigate }: CommandMenuProps) {
  const invoices = useStore((state) => state.invoices)
  const clients = useStore((state) => state.clients)
  const services = useStore((state) => state.services)
  const user = useStore((state) => state.user)
  const [search, setSearch] = React.useState("")

  const isAdmin = user?.role === 'admin'

  const handleSelect = (page: string) => {
    onNavigate(page)
    onOpenChange(false)
    setSearch("")
  }

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
        
        {!isAdmin && (
            <CommandGroup heading="Actions rapides">
                <CommandItem onSelect={() => handleSelect("new-quote")} className="gap-3 py-3 cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                    <p className="font-medium text-foreground">Nouveau devis</p>
                    <p className="text-xs text-muted-foreground">Créer un nouveau devis</p>
                    </div>
                </CommandItem>
                <CommandItem onSelect={() => handleSelect("clients")} className="gap-3 py-3 cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                    <p className="font-medium text-foreground">Nouveau client</p>
                    <p className="text-xs text-muted-foreground">Ajouter un client</p>
                    </div>
                </CommandItem>
            </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleSelect("dashboard")} className="gap-3 py-2 cursor-pointer">
            <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground">Tableau de bord</span>
          </CommandItem>

          <CommandItem onSelect={() => handleSelect("analytics")} className="gap-3 py-2 cursor-pointer">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground">Statistiques</span>
          </CommandItem>

          {isAdmin && (
            <>
                <CommandItem onSelect={() => handleSelect("users")} className="gap-3 py-2 cursor-pointer">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">Utilisateurs</span>
                </CommandItem>
                <CommandItem onSelect={() => handleSelect("audit")} className="gap-3 py-2 cursor-pointer">
                    <ScrollText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">Journal Audit</span>
                </CommandItem>
            </>
          )}

          {!isAdmin && (
            <>
                <CommandItem onSelect={() => handleSelect("invoices")} className="gap-3 py-2 cursor-pointer">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">Factures</span>
                </CommandItem>
                <CommandItem onSelect={() => handleSelect("clients")} className="gap-3 py-2 cursor-pointer">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">Clients</span>
                </CommandItem>
                <CommandItem onSelect={() => handleSelect("payments")} className="gap-3 py-2 cursor-pointer">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">Paiements</span>
                </CommandItem>
            </>
          )}

          <CommandItem onSelect={() => handleSelect("settings")} className="gap-3 py-2 cursor-pointer">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground">Paramètres</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {!isAdmin && (
            <>
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

                {filteredClients.length > 0 && (
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
            </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
