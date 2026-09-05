"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Plus, MoreVertical, Edit2, Trash2, DownloadCloud, Users, Mail, Phone, MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useStore, type Client } from "@/lib/store"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { Pagination } from "@/components/ui/pagination-custom"
import { EmptyState } from "@/components/ui/empty-state"
// ── Design System
import { PageHeader } from "@/components/ui/page-header"
import { SearchBar } from "@/components/ui/search-bar"
import { ShieldAlert } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  DataTable,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableHeaderCell,
  DataTableCell,
  ActionsCell,
} from "@/components/ui/data-table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

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
  const [clientToDeleteId, setClientToDeleteId] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [newClient, setNewClient] = React.useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  })

  const filteredClients = React.useMemo(() => {
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email.toLowerCase().includes(searchQuery.toLowerCase())
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

  if (!isDataLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Chargement des clients...</p>
        </div>
      </div>
    )
  }

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!newClient.name || !newClient.email) {
      toast.error("Le nom et l'email sont requis.")
      return
    }

    const tempId = crypto.randomUUID()
    const clientToCreate: Client = {
      id: tempId,
      name: newClient.name,
      email: newClient.email,
      phone: newClient.phone,
      address: newClient.address,
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientToCreate),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${response.status}`)
      }

      const createdClient = await response.json()

      // SERVER-FIRST: only close dialog and reset form AFTER server confirms success.
      addClient(createdClient) // use confirmed server record, not temp
      setIsAddDialogOpen(false)
      setNewClient({ name: "", email: "", phone: "", address: "" })
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
      const response = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${response.status}`)
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

    if (!editingClient.name || !editingClient.email) {
        toast.error("Le nom et l'email sont requis.")
        return
    }

    const originalClient = clients.find(c => c.id === editingClient.id)
    const clientToSave = editingClient

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/clients/${clientToSave.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientToSave),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${response.status}`)
      }

      const updatedClient = await response.json()

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
    <div className="flex-1 flex flex-col overflow-hidden space-y-6">
      {user?.role !== 'admin' && (
        <Alert variant="default" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50 mb-6">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="font-medium">
            Vous êtes en mode lecture seule (Opérateur). Seul un Administrateur peut modifier ces paramètres.
          </AlertDescription>
        </Alert>
      )}

      {/* ── En-tête de page (Design System) ───────────────────────────── */}
      <PageHeader
        title="Clients"
        description="Gérez votre base de clients et leurs coordonnées"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                const headers = ["Nom", "Email", "Telephone", "Adresse"];
                const rows = clients.map(c => [c.name, c.email, c.phone, c.address]);
                const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
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
            {user?.role === 'admin' && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg shadow-primary/20">
                  <Plus className="w-4 h-4" />
                  Nouveau client
                </Button>
              </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Ajouter un nouveau client</DialogTitle>
                <VisuallyHidden>
                  <DialogDescription>Formulaire pour ajouter un client à votre base de données</DialogDescription>
                </VisuallyHidden>
              </DialogHeader>
              <form onSubmit={handleAddClient} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-muted-foreground">Nom complet / Raison sociale</Label>
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
                  <Label htmlFor="email" className="text-muted-foreground">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="contact@entreprise.ga"
                    className="bg-secondary border-border text-foreground"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-muted-foreground">Téléphone</Label>
                  <Input
                    id="phone"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    placeholder="+241 XX XX XX XX"
                    className="bg-secondary border-border text-foreground"
                    disabled={isSubmitting}
                  />
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
            )}

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Modifier le client</DialogTitle>
                  <VisuallyHidden>
                    <DialogDescription>Formulaire pour modifier un client existant</DialogDescription>
                  </VisuallyHidden>
                </DialogHeader>
                <form onSubmit={handleEditClient} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name" className="text-muted-foreground">Nom complet / Raison sociale</Label>
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
                    <Label htmlFor="edit-email" className="text-muted-foreground">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editingClient?.email || ''}
                      onChange={(e) => editingClient && setEditingClient({ ...editingClient, email: e.target.value })}
                      placeholder="contact@entreprise.ga"
                      className="bg-secondary border-border text-foreground"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone" className="text-muted-foreground">Téléphone</Label>
                    <Input
                      id="edit-phone"
                      value={editingClient?.phone || ''}
                      onChange={(e) => editingClient && setEditingClient({ ...editingClient, phone: e.target.value })}
                      placeholder="+241 XX XX XX XX"
                      className="bg-secondary border-border text-foreground"
                      disabled={isSubmitting}
                    />
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
                    <Avatar className="w-8 h-8 ring-1 ring-border">
                      <AvatarFallback className="bg-gradient-to-br from-primary/80 to-accent text-primary-foreground text-xs font-semibold">
                        {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm text-foreground">{client.name}</span>
                  </div>
                </DataTableCell>
                <DataTableCell>{client.email}</DataTableCell>
                <DataTableCell>
                  {client.phone || <span className="text-muted-foreground/30">—</span>}
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge variant="active" />
                </DataTableCell>
                <ActionsCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                      {user?.role === 'admin' && (
                        <DropdownMenuItem className="gap-2" onClick={() => { setEditingClient(client); setIsEditDialogOpen(true) }}>
                          <Edit2 className="w-4 h-4" /> Modifier
                        </DropdownMenuItem>
                      )}
                      {user?.role === 'admin' && (
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive"
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
            actionLabel={!searchQuery && user?.role === 'admin' ? "Nouveau client" : undefined}
            onAction={!searchQuery && user?.role === 'admin' ? () => setIsAddDialogOpen(true) : undefined}
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
                    <Avatar className="w-10 h-10 ring-1 ring-border">
                      <AvatarFallback className="bg-gradient-to-br from-primary/80 to-accent text-primary-foreground text-sm font-semibold">
                        {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-bold text-sm">{client.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {client.email}
                        {client.phone && <span className="text-muted-foreground/50"> • {client.phone}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge variant="active" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 bg-card border-border">
                        {user?.role === 'admin' && (
                          <DropdownMenuItem 
                            className="gap-2"
                            onClick={() => {
                              setEditingClient(client)
                              setIsEditDialogOpen(true)
                            }}
                          >
                            <Edit2 className="w-4 h-4" /> Modifier
                          </DropdownMenuItem>
                        )}
                        {user?.role === 'admin' && (
                          <DropdownMenuItem
                            className="gap-2 text-destructive focus:text-destructive"
                            onClick={() => handleDelete(client.id)}
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
              actionLabel={!searchQuery && user?.role === 'admin' ? "Nouveau client" : undefined}
              onAction={!searchQuery && user?.role === 'admin' ? () => setIsAddDialogOpen(true) : undefined}
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
                      <Avatar className="w-10 h-10 ring-1 ring-border">
                        <AvatarFallback className="bg-gradient-to-br from-primary/80 to-accent text-primary-foreground text-sm font-semibold">
                          {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                            <MoreVertical className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 bg-card border-border">
                          {user?.role === 'admin' && (
                            <DropdownMenuItem 
                              className="gap-2"
                              onClick={() => {
                                setEditingClient(client)
                                setIsEditDialogOpen(true)
                              }}
                            >
                              <Edit2 className="w-4 h-4" /> Modifier
                            </DropdownMenuItem>
                          )}
                          {user?.role === 'admin' && (
                            <DropdownMenuItem
                              className="gap-2 text-destructive focus:text-destructive"
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
                        <span className="truncate font-medium">{client.email}</span>
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
                actionLabel={!searchQuery && user?.role === 'admin' ? "Nouveau client" : undefined}
                onAction={!searchQuery && user?.role === 'admin' ? () => setIsAddDialogOpen(true) : undefined}
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
    </div>
  )
}
