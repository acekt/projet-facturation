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
} from "lucide-react"

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (page: string) => void
}

export function CommandMenu({ open, onOpenChange, onNavigate }: CommandMenuProps) {
  const handleSelect = (page: string) => {
    onNavigate(page)
    onOpenChange(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Rechercher une action, une facture, un client..." 
        className="border-b border-border"
      />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>Aucun resultat trouve.</CommandEmpty>
        
        <CommandGroup heading="Actions rapides">
          <CommandItem onSelect={() => handleSelect("new-invoice")} className="gap-3 py-3 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Plus className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Nouvelle facture</p>
              <p className="text-xs text-muted-foreground">Creer une nouvelle facture</p>
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

        <CommandGroup heading="Factures recentes">
          <CommandItem className="gap-3 py-2 cursor-pointer">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 flex items-center justify-between">
              <span className="text-foreground">FAC-2024-0042</span>
              <span className="text-xs text-muted-foreground">Societe Gabon Mining</span>
            </div>
          </CommandItem>
          <CommandItem className="gap-3 py-2 cursor-pointer">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 flex items-center justify-between">
              <span className="text-foreground">FAC-2024-0041</span>
              <span className="text-xs text-muted-foreground">Banque BGFI</span>
            </div>
          </CommandItem>
          <CommandItem className="gap-3 py-2 cursor-pointer">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 flex items-center justify-between">
              <span className="text-foreground">FAC-2024-0040</span>
              <span className="text-xs text-muted-foreground">Total Gabon</span>
            </div>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
