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
  const [search, setSearch] = React.useState("")

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
          <CommandItem onSelect={() => handleSelect("new-invoice")} className="gap-3 py-3 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Plus className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Nouvelle facture</p>
              <p className="text-xs text-muted-foreground">Créer une facture directe</p>
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
          <CommandItem onSelect={() => handleSelect("services")} className="gap-3 py-3 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <p className="font-medium text-foreground">Nouveau service</p>
              <p className="text-xs text-muted-foreground">Ajouter au catalogue</p>
            </div>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleSelect("dashboard")} className="gap-3 py-2 cursor-pointer">
            <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground">Tableau de bord</span>
          </CommandItem>
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
          <CommandItem onSelect={() => handleSelect("settings")} className="gap-3 py-2 cursor-pointer">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground">Parametres</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

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

        {filteredServices.length > 0 && (
          <CommandGroup heading="Services">
            {filteredServices.map((service) => (
              <CommandItem key={service.id} onSelect={() => handleSelect("services")} className="gap-3 py-2 cursor-pointer">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-foreground">{service.name}</span>
                  <span className="text-xs text-muted-foreground">{service.category}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
