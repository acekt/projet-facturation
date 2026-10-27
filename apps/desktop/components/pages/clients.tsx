"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Plus, MoreVertical, Edit2, Trash2, DownloadCloud, Users, Mail, Phone, MapPin, Eye } from "lucide-react"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { VisuallyHidden } from "@workspace/ui/components/visually-hidden"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { useStore, type Client } from "@/lib/store"
import { toast } from "sonner"
import { formatCurrency, getInitials, escapeCsvCell, cn } from "@/lib/utils"
import { Pagination } from "@workspace/ui/components/pagination-custom"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { createClient, updateClient as updateClientAction, deleteClient } from "@/app/actions/client.actions"
// ── Design System
import { PageHeader } from "@workspace/ui/components/page-header"
import { SearchBar } from "@workspace/ui/components/search-bar"
import { ShieldAlert } from "lucide-react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import {
  DataTable,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableHeaderCell,
  DataTableCell,
  ActionsCell,
} from "@workspace/ui/components/data-table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"

export function ClientsPage() {
  const clients = useStore(state => state.clients)
  const setClients = useStore(state => state.setClients)
  const addClient = useStore(state => state.addClient)
  const removeClient = useStore(state => state.removeClient)
  const updateClient = useStore(state => state.updateClient)
  const replaceClient = useStore(state => state.replaceClient)
  const invoices = useStore(state => state.invoices)
  const user = useStore(state => state.user)
  const viewFormat = useStore(state => state.viewFormat)
  const setViewFormat = useStore(state => state.setViewFormat)
  const isDataLoaded = useStore(state => state.isDataLoaded)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 9 // Grid 3x3
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingClient, setEditingClient] = React.useState<Client | null>(null)
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = React.useState(false)
  const [clientToDeleteId, setClientToDeleteId] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [newClient, setNewClient] = React.useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    nif: "",
    rccm: "",
    status: "active" as "active" | "inactive",
  })

  const filteredClients = React.useMemo(() => {
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [clients, searchQuery])

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage)
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!newClient.name.trim()) {
      toast.error("Le nom complet ou la raison sociale est requis.")
      return
    }

    if (!newClient.phone || !newClient.phone.trim()) {
      toast.error("Le numéro de téléphone est requis.")
      return
    }

    const phoneRegex = /^(\+?[0-9\s-]{6,25})$/
    if (!phoneRegex.test(newClient.phone.trim())) {
      toast.error("Format de téléphone invalide (ex: +241 01 02 03 04 ou 074000000).")
      return
    }

    if (newClient.email && newClient.email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(newClient.email.trim())) {
        toast.error("L'adresse email est invalide.")
        return
      }
    }

    const tempId = crypto.randomUUID()
    const clientToCreate: import("@/lib/types/api").ClientCreateRequest = {
      name: newClient.name.trim(),
      email: newClient.email && newClient.email.trim() !== '' ? newClient.email.trim() : null,
      phone: newClient.phone.trim(),
      address: newClient.address?.trim() || null,
      nif: newClient.nif?.trim() || null,
      rccm: newClient.rccm?.trim() || null,
      status: (newClient.status as 'active' | 'inactive') || "active",
    }

    setIsSubmitting(true)
    try {
      const response = await createClient(clientToCreate)

      if (!response.success) {
        throw new Error(response.error)
      }

      const createdClient = response.data

      // SERVER-FIRST: only close dialog and reset form AFTER server confirms success.
      addClient(createdClient) // use confirmed server record, not temp
      setIsAddDialogOpen(false)
      setNewClient({ name: "", email: "", phone: "", address: "", nif: "", rccm: "", status: "active" })
      toast.success("Client ajouté avec succès")
    } catch (error) {
      // Form stays open — user can correct and retry
      const msg = error instanceof Error ? error.message : 'Erreur inconnue'
      toast.error(`Échec de l'ajout : ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (isSubmitting) return;

    // Capture the full client object BEFORE removing it so we can restore it on failure
    const clientToRestore = clients.find(c => c.id === id)

    // OPTIMISTIC UI — atomic removal; rollback re-inserts via addClient if needed.
    removeClient(id)
    toast.success("Client supprimé avec succès")
    setClientToDeleteId(null)

    setIsSubmitting(true)
    try {
      const response = await deleteClient(id)
      if (!response.success) {
        throw new Error(response.error)
      }
    } catch (error) {
      // ROLLBACK — re-insert the previously removed client
      if (clientToRestore) addClient(clientToRestore)
      const msg = error instanceof Error ? error.message : 'Erreur inconnue'
      toast.error(`Échec de la suppression : ${msg}. Restauration effectuée.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClient || isSubmitting) return

    if (!editingClient.name.trim()) {
      toast.error("Le nom complet ou la raison sociale est requis.")
      return
    }

    if (!editingClient.phone || !editingClient.phone.trim()) {
      toast.error("Le numéro de téléphone est requis.")
      return
    }

    const phoneRegex = /^(\+?[0-9\s-]{6,25})$/
    if (!phoneRegex.test(editingClient.phone.trim())) {
      toast.error("Format de téléphone invalide (ex: +241 01 02 03 04 ou 074000000).")
      return
    }

    if (editingClient.email && editingClient.email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(editingClient.email.trim())) {
        toast.error("L'adresse email est invalide.")
        return
      }
    }

    const originalClient = clients.find(c => c.id === editingClient.id)
    const clientToSave: Client = {
      ...editingClient,
      name: editingClient.name.trim(),
      email: editingClient.email && editingClient.email.trim() !== '' ? editingClient.email.trim() : null,
      phone: editingClient.phone?.trim() || null,
      address: editingClient.address?.trim() || null,
      nif: editingClient.nif?.trim() || null,
      rccm: editingClient.rccm?.trim() || null,
      status: editingClient.status || "active",
    }

    setIsSubmitting(true)
    try {
      const response = await updateClientAction(clientToSave.id, clientToSave)

      if (!response.success) {
        throw new Error(response.error)
      }

      const updatedClient = response.data

      // SERVER-FIRST: apply optimistic update only after server confirms.
      updateClient(clientToSave.id, updatedClient)
      setIsEditDialogOpen(false)
      setEditingClient(null)
      toast.success("Client mis à jour avec succès")
    } catch (error) {
      // Form stays open with data intact — user can correct and retry
      if (originalClient) updateClient(clientToSave.id, originalClient)
      const msg = error instanceof Error ? error.message : 'Erreur inconnue'
      toast.error(`Échec de la modification : ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {!isDataLoaded ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground font-medium">Chargement des clients...</p>
          </div>
        </div>
      ) : (
    <div className="flex-1 flex flex-col overflow-hidden space-y-6">

      {/* ── En-tête de page (Design System) ───────────────────────────── */}
      <PageHeader
        title="Clients"
        description="Gérez votre base de clients et leurs coordonnées"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                const headers = ["Nom", "Email", "Telephone", "Adresse", "NIF", "RCCM"];
                const targetList = searchQuery.trim() ? filteredClients : clients;
                const rows = targetList.map(c => [
                  escapeCsvCell(c.name),
                  escapeCsvCell(c.email),
                  escapeCsvCell(c.phone || ''),
                  escapeCsvCell(c.address || ''),
                  escapeCsvCell(c.nif || ''),
                  escapeCsvCell(c.rccm || '')
                ]);
                const csvContent = [headers.map(escapeCsvCell).join(","), ...rows.map(r => r.join(","))].join("\n");
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.setAttribute("download", `clients_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="gap-2 hidden sm:flex"
            >
              <DownloadCloud className="w-4 h-4" />
              Export CSV
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="primary-shadow" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nouveau client
                </Button>
              </DialogTrigger>
            <DialogContent className="bg-card border-border" side="right">
              <DialogHeader>
                <DialogTitle className="text-foreground">Ajouter un nouveau client</DialogTitle>
                <VisuallyHidden>
                  <DialogDescription>Formulaire pour ajouter un client à votre base de données</DialogDescription>
                </VisuallyHidden>
              </DialogHeader>
              <form onSubmit={handleAddClient} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-muted-foreground">Nom complet / Raison sociale <span className="text-destructive">*</span></Label>
                  <Input
                    id="name"
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    placeholder="Ex: Societe Gabon Mining"
                    className="bg-secondary border-border text-foreground"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-muted-foreground">Email <span className="text-xs text-muted-foreground/60">(optionnel)</span></Label>
                  <Input
                    id="email"
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="contact@entreprise.ga"
                    className="bg-secondary border-border text-foreground"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-muted-foreground">Téléphone <span className="text-destructive">*</span></Label>
                    <Input
                      id="phone"
                      required
                      value={newClient.phone}
                      onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                      placeholder="+241 01 02 03 04"
                      className="bg-secondary border-border text-foreground"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-muted-foreground">Statut <span className="text-destructive">*</span></Label>
                    <Select
                      value={newClient.status}
                      onValueChange={(val) => setNewClient({ ...newClient, status: val as 'active' | 'inactive' })}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="status" className="w-full bg-secondary border-border text-foreground">
                        <SelectValue placeholder="Statut" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="active">Actif</SelectItem>
                        <SelectItem value="inactive">Inactif / Suspendu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-muted-foreground">Adresse</Label>
                  <Input
                    id="address"
                    value={newClient.address}
                    onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                    placeholder="Libreville, Gabon"
                    className="bg-secondary border-border text-foreground"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nif" className="text-muted-foreground">NIF</Label>
                    <Input
                      id="nif"
                      value={newClient.nif}
                      onChange={(e) => setNewClient({ ...newClient, nif: e.target.value })}
                      placeholder="Ex: 0123456A"
                      className="bg-secondary border-border text-foreground font-mono text-sm"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rccm" className="text-muted-foreground">RCCM</Label>
                    <Input
                      id="rccm"
                      value={newClient.rccm}
                      onChange={(e) => setNewClient({ ...newClient, rccm: e.target.value })}
                      placeholder="Ex: RG/LBV/2026/B/1234"
                      className="bg-secondary border-border text-foreground font-mono text-sm"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-4"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Enregistrement..." : "Enregistrer le client"}
                </Button>
              </form>
              </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="bg-card border-border" side="right">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Modifier le client</DialogTitle>
                  <VisuallyHidden>
                    <DialogDescription>Formulaire pour modifier un client existant</DialogDescription>
                  </VisuallyHidden>
                </DialogHeader>
                <form onSubmit={handleEditClient} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name" className="text-muted-foreground">Nom complet / Raison sociale <span className="text-destructive">*</span></Label>
                    <Input
                      id="edit-name"
                      value={editingClient?.name || ''}
                      onChange={(e) => editingClient && setEditingClient({ ...editingClient, name: e.target.value })}
                      placeholder="Ex: Societe Gabon Mining"
                      className="bg-secondary border-border text-foreground"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email" className="text-muted-foreground">Email <span className="text-xs text-muted-foreground/60">(optionnel)</span></Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editingClient?.email || ''}
                      onChange={(e) => editingClient && setEditingClient({ ...editingClient, email: e.target.value })}
                      placeholder="contact@entreprise.ga"
                      className="bg-secondary border-border text-foreground"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-phone" className="text-muted-foreground">Téléphone <span className="text-destructive">*</span></Label>
                      <Input
                        id="edit-phone"
                        required
                        value={editingClient?.phone || ''}
                        onChange={(e) => editingClient && setEditingClient({ ...editingClient, phone: e.target.value })}
                        placeholder="+241 01 02 03 04"
                        className="bg-secondary border-border text-foreground"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-status" className="text-muted-foreground">Statut <span className="text-destructive">*</span></Label>
                      <Select
                        value={editingClient?.status || "active"}
                        onValueChange={(val) => editingClient && setEditingClient({ ...editingClient, status: val as 'active' | 'inactive' })}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger id="edit-status" className="w-full bg-secondary border-border text-foreground">
                          <SelectValue placeholder="Statut" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="active">Actif</SelectItem>
                          <SelectItem value="inactive">Inactif / Suspendu</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-address" className="text-muted-foreground">Adresse</Label>
                    <Input
                      id="edit-address"
                      value={editingClient?.address || ''}
                      onChange={(e) => editingClient && setEditingClient({ ...editingClient, address: e.target.value })}
                      placeholder="Libreville, Gabon"
                      className="bg-secondary border-border text-foreground"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-nif" className="text-muted-foreground">NIF</Label>
                      <Input
                        id="edit-nif"
                        value={editingClient?.nif || ''}
                        onChange={(e) => editingClient && setEditingClient({ ...editingClient, nif: e.target.value })}
                        placeholder="Ex: 0123456A"
                        className="bg-secondary border-border text-foreground font-mono text-sm"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-rccm" className="text-muted-foreground">RCCM</Label>
                      <Input
                        id="edit-rccm"
                        value={editingClient?.rccm || ''}
                        onChange={(e) => editingClient && setEditingClient({ ...editingClient, rccm: e.target.value })}
                        placeholder="Ex: RG/LBV/2026/B/1234"
                        className="bg-secondary border-border text-foreground font-mono text-sm"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-4"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Enregistrement..." : "Enregistrer les modifications"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {/* ── Barre de recherche (Design System) ─────────────────────── */}
      <SearchBar
        placeholder="Rechercher un client..."
        value={searchQuery}
        onChange={setSearchQuery}
        viewFormatKey="clients"
      />

      {/* ── Vue Tableau (Design System) ────────────────────────────────── */}
      {(!viewFormat.clients || viewFormat.clients === 'table') && (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Client</DataTableHeaderCell>
              <DataTableHeaderCell>Email</DataTableHeaderCell>
              <DataTableHeaderCell>Téléphone</DataTableHeaderCell>
              <DataTableHeaderCell>Statut</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {paginatedClients.map((client) => (
              <DataTableRow key={client.id}>
                <DataTableCell>
                  <div className="flex items-center gap-3">
                    <div className="relative w-8 h-8 flex-shrink-0">
                      <Avatar className="w-8 h-8 ring-1 ring-border">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                          {getInitials(client.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-card shadow-sm transition-colors",
                          client.status === 'inactive' ? "bg-amber-500" : "bg-emerald-500"
                        )}
                        title={client.status === 'inactive' ? "Client inactif / suspendu" : "Client actif"}
                      />
                    </div>
                    <span className="font-medium text-sm text-foreground">{client.name}</span>
                  </div>
                </DataTableCell>
                <DataTableCell>{client.email || <span className="text-muted-foreground/30">—</span>}</DataTableCell>
                <DataTableCell>
                  {client.phone || <span className="text-muted-foreground/30">—</span>}
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge 
                    variant={client.status === 'inactive' ? 'inactive' : 'active'} 
                    label={client.status === 'inactive' ? 'Inactif' : 'Actif'} 
                  />
                </DataTableCell>
                <ActionsCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-lg">
                      <DropdownMenuItem
                        className="gap-2 cursor-pointer font-medium"
                        onClick={() => {
                          setSelectedClient(client)
                          setIsDetailsDialogOpen(true)
                        }}
                      >
                        <Eye className="w-4 h-4 text-primary" /> Voir les détails
                      </DropdownMenuItem>

                      {(user?.role === 'admin' || user?.role === 'user') && (
                        <>
                          <DropdownMenuSeparator className="bg-border/60" />
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => {
                              setEditingClient(client)
                              setIsEditDialogOpen(true)
                            }}
                          >
                            <Edit2 className="w-4 h-4" /> Modifier
                          </DropdownMenuItem>
                        </>
                      )}

                      {user?.role === 'admin' && (
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                          onClick={() => setClientToDeleteId(client.id)}
                        >
                          <Trash2 className="w-4 h-4" /> Supprimer
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ActionsCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
      {(!viewFormat.clients || viewFormat.clients === 'table') && paginatedClients.length === 0 && (
        <div className="p-8 text-center">
          <EmptyState
            icon={Users}
            title={searchQuery ? "Aucun résultat" : "Aucun client"}
            description={searchQuery ? "Aucun client ne correspond à votre recherche." : "Ajoutez votre premier client pour commencer à générer des devis."}
            actionLabel={!searchQuery ? "Nouveau client" : undefined}
            onAction={!searchQuery ? () => setIsAddDialogOpen(true) : undefined}
          />
        </div>
      )}

      {viewFormat.clients === 'horizontal' && (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <div className="space-y-3">
          {paginatedClients.map((client) => (
            <Card key={client.id} className="bg-card border-border hover:border-primary/30 transition-all group shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative w-10 h-10 flex-shrink-0">
                      <Avatar className="w-10 h-10 ring-1 ring-border">
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                          {getInitials(client.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-card shadow-sm transition-colors",
                          client.status === 'inactive' ? "bg-amber-500" : "bg-emerald-500"
                        )}
                        title={client.status === 'inactive' ? "Client inactif / suspendu" : "Client actif"}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{client.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {client.email || <span className="text-muted-foreground/50">Pas d'email</span>}
                        {client.phone && <span className="text-muted-foreground/50"> • {client.phone}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge 
                      variant={client.status === 'inactive' ? 'inactive' : 'active'} 
                      label={client.status === 'inactive' ? 'Inactif' : 'Actif'} 
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-lg">
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer font-medium"
                          onClick={() => {
                            setSelectedClient(client)
                            setIsDetailsDialogOpen(true)
                          }}
                        >
                          <Eye className="w-4 h-4 text-primary" /> Voir les détails
                        </DropdownMenuItem>
                        {(user?.role === 'admin' || user?.role === 'user') && (
                          <>
                            <DropdownMenuSeparator className="bg-border/60" />
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onClick={() => {
                                setEditingClient(client)
                                setIsEditDialogOpen(true)
                              }}
                            >
                              <Edit2 className="w-4 h-4" /> Modifier
                            </DropdownMenuItem>
                          </>
                        )}
                        {user?.role === 'admin' && (
                          <DropdownMenuItem
                            className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                            onClick={() => setClientToDeleteId(client.id)}
                          >
                            <Trash2 className="w-4 h-4" /> Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {paginatedClients.length === 0 && (
            <EmptyState
              icon={Users}
              title={searchQuery ? "Aucun client trouvé" : "Base clients vide"}
              description={searchQuery ? "Aucun client ne correspond à votre recherche." : "Ajoutez votre premier client pour commencer à générer des devis."}
              actionLabel={!searchQuery ? "Nouveau client" : undefined}
              onAction={!searchQuery ? () => setIsAddDialogOpen(true) : undefined}
            />
          )}
        </div>
        </div>
      )}

      {viewFormat.clients === 'block' && (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedClients.map((client, index) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-card border-border hover:border-primary/30 transition-all group overflow-hidden shadow-sm">
                <CardContent className="p-0">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 flex-shrink-0">
                          <Avatar className="w-10 h-10 ring-1 ring-border">
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                              {getInitials(client.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={cn(
                              "absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-card shadow-sm transition-colors",
                              client.status === 'inactive' ? "bg-amber-500" : "bg-emerald-500"
                            )}
                            title={client.status === 'inactive' ? "Client inactif / suspendu" : "Client actif"}
                          />
                        </div>
                        <StatusBadge
                          variant={client.status === 'inactive' ? 'inactive' : 'active'}
                          label={client.status === 'inactive' ? 'Inactif' : 'Actif'}
                        />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                            <MoreVertical className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-lg">
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer font-medium"
                            onClick={() => {
                              setSelectedClient(client)
                              setIsDetailsDialogOpen(true)
                            }}
                          >
                            <Eye className="w-4 h-4 text-primary" /> Voir les détails
                          </DropdownMenuItem>
                          {(user?.role === 'admin' || user?.role === 'user') && (
                            <>
                              <DropdownMenuSeparator className="bg-border/60" />
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer"
                                onClick={() => {
                                  setEditingClient(client)
                                  setIsEditDialogOpen(true)
                                }}
                              >
                                <Edit2 className="w-4 h-4" /> Modifier
                              </DropdownMenuItem>
                            </>
                          )}
                          {user?.role === 'admin' && (
                            <DropdownMenuItem
                              className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                              onClick={() => setClientToDeleteId(client.id)}
                            >
                              <Trash2 className="w-4 h-4" /> Supprimer
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <h3 className="font-semibold text-foreground text-sm mb-1 truncate uppercase tracking-tighter">{client.name}</h3>
                    <div className="space-y-1.5 mt-3">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Mail className="w-3.5 h-3.5 text-primary/40" />
                        <span className="truncate font-medium">{client.email || <span className="text-muted-foreground/40 font-normal">Non renseigné</span>}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Phone className="w-3.5 h-3.5 text-primary/40" />
                        <span className="font-medium">{client.phone || 'Non renseigné'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="truncate font-medium">
                          {client.address || <span className="text-muted-foreground/30">—</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-secondary/30 px-4 py-2 border-t border-border/50 flex items-center justify-between">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Chiffre d'Affaires</div>
                    <div className="font-semibold text-foreground text-sm tracking-tighter">
                      {formatCurrency(invoices
                        ?.filter(inv => inv.clientId === client.id && inv.status === 'PAID')
                        .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {paginatedClients.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={Users}
                title={searchQuery ? "Aucun client trouvé" : "Base clients vide"}
                description={searchQuery ? "Aucun client ne correspond à votre recherche." : "Ajoutez votre premier client pour commencer à générer des devis."}
                actionLabel={!searchQuery ? "Nouveau client" : undefined}
                onAction={!searchQuery ? () => setIsAddDialogOpen(true) : undefined}
              />
            </div>
          )}
        </div>
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      <AlertDialog open={clientToDeleteId !== null} onOpenChange={(open) => !open && setClientToDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce client ? Cette action appliquera un Soft Delete pour conserver l'historique de facturation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clientToDeleteId && handleDelete(clientToDeleteId)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={isSubmitting}
            >
              {isSubmitting ? "En cours..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog Détails du Client (Lecture & Consultation) ──── */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3.5 mb-1">
              <div className="relative w-12 h-12 flex-shrink-0">
                <Avatar className="w-12 h-12 ring-2 ring-primary/20">
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold text-base">
                    {selectedClient ? getInitials(selectedClient.name) : "CL"}
                  </AvatarFallback>
                </Avatar>
                {selectedClient && (
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full ring-2 ring-card shadow-sm",
                      selectedClient.status === 'inactive' ? "bg-amber-500" : "bg-emerald-500"
                    )}
                    title={selectedClient.status === 'inactive' ? "Client inactif / suspendu" : "Client actif"}
                  />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-foreground text-xl font-bold truncate">
                  {selectedClient?.name}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  {selectedClient && (
                    <StatusBadge
                      variant={selectedClient.status === 'inactive' ? 'inactive' : 'active'}
                      label={selectedClient.status === 'inactive' ? 'Compte Inactif' : 'Compte Actif'}
                    />
                  )}
                  {selectedClient?.nif && (
                    <span className="text-[11px] font-mono text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded border border-border/50">
                      NIF: {selectedClient.nif}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <VisuallyHidden>
              <DialogDescription>Fiche complète et coordonnées du client</DialogDescription>
            </VisuallyHidden>
          </DialogHeader>

          {selectedClient && (
            <div className="space-y-4 py-2 text-sm">
              {/* Coordonnées de contact */}
              <div className="p-3.5 rounded-lg bg-secondary/30 border border-border/60 space-y-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Coordonnées & Contact
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="flex items-center gap-2 text-foreground">
                    <Mail className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">
                      {selectedClient.email ? (
                        <a href={`mailto:${selectedClient.email}`} className="text-primary hover:underline">
                          {selectedClient.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground/60 italic">Pas d'adresse email</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <Phone className="w-4 h-4 text-primary shrink-0" />
                    <span>
                      {selectedClient.phone ? (
                        <a href={`tel:${selectedClient.phone}`} className="hover:underline">
                          {selectedClient.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground/60 italic">Non renseigné</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-foreground sm:col-span-2">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>
                      {selectedClient.address || <span className="text-muted-foreground/60 italic">Aucune adresse géographique enregistrée</span>}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mentions fiscales CEMAC */}
              <div className="p-3.5 rounded-lg bg-secondary/20 border border-border/50 space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Identifiants Fiscaux & Réglementaires (OHADA / Gabon)
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">NIF :</span>
                    <p className="font-mono font-medium text-foreground mt-0.5">
                      {selectedClient.nif || <span className="text-muted-foreground/50 font-normal italic">—</span>}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">RCCM :</span>
                    <p className="font-mono font-medium text-foreground mt-0.5">
                      {selectedClient.rccm || <span className="text-muted-foreground/50 font-normal italic">—</span>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Synthèse Facturation */}
              <div className="p-3.5 rounded-lg bg-secondary/30 border border-border/50 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Volume d'Affaires Encaissé
                  </div>
                  <div className="text-lg font-bold text-foreground mt-0.5">
                    {formatCurrency(
                      invoices
                        ?.filter(inv => inv.clientId === selectedClient.id && inv.status === 'PAID')
                        .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {invoices?.filter(inv => inv.clientId === selectedClient.id).length || 0}
                  </span> facture(s) émise(s)
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>
                  Fermer
                </Button>
                {(user?.role === 'admin' || user?.role === 'user') && (
                  <Button
                    variant="default"
                    className="gap-1.5"
                    onClick={() => {
                      setIsDetailsDialogOpen(false)
                      setEditingClient(selectedClient)
                      setIsEditDialogOpen(true)
                    }}
                  >
                    <Edit2 className="w-4 h-4" /> Modifier ce client
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
      )}
    </>
  )
}
