"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Plus, Search, Mail, Phone, MapPin, MoreVertical, Edit2, Trash2 } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { useStore } from "@/lib/store"
import { toast } from "sonner"
import { DownloadCloud, Users } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Pagination } from "@/components/ui/pagination-custom"
import { EmptyState } from "@/components/ui/empty-state"
import { ViewFormatSelector } from "@/components/ui/view-format-selector"

export function ClientsPage() {
  const clients = useStore(state => state.clients)
  const setClients = useStore(state => state.setClients)
  const invoices = useStore(state => state.invoices)
  const user = useStore(state => state.user)
  const viewFormat = useStore(state => state.viewFormat)
  const setViewFormat = useStore(state => state.setViewFormat)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 9 // Grid 3x3
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingClient, setEditingClient] = React.useState<any>(null)
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

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient),
      })

      if (!response.ok) throw new Error('Failed to add client')

      const updatedClients = await fetch('/api/clients').then(res => res.json())
      setClients(updatedClients)

      setIsAddDialogOpen(false)
      setNewClient({ name: "", email: "", phone: "", address: "" })
      toast.success("Client ajouté avec succès")
    } catch (error) {
      toast.error("Erreur lors de l'ajout du client")
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete client')

      toast.success("Client supprimé avec succès")

      const newClients = await fetch('/api/clients').then(res => res.json())
      setClients(newClients)
    } catch (error) {
      toast.error("Erreur lors de la suppression")
    }
  }

  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`/api/clients/${editingClient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingClient),
      })

      if (!response.ok) throw new Error('Failed to update client')

      const updatedClients = await fetch('/api/clients').then(res => res.json())
      setClients(updatedClients)

      setIsEditDialogOpen(false)
      setEditingClient(null)
      toast.success("Client mis à jour avec succès")
    } catch (error) {
      toast.error("Erreur lors de la modification du client")
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">Gérez votre base de clients et leurs coordonnées</p>
        </div>
        <div className="flex items-center gap-2">
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
          {user?.role === 'user' && (
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
                />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-4">
                Enregistrer le client
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
                    onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                    placeholder="Ex: Societe Gabon Mining"
                    className="bg-secondary border-border text-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email" className="text-muted-foreground">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingClient?.email || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                    placeholder="contact@entreprise.ga"
                    className="bg-secondary border-border text-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone" className="text-muted-foreground">Téléphone</Label>
                  <Input
                    id="edit-phone"
                    value={editingClient?.phone || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                    placeholder="+241 XX XX XX XX"
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address" className="text-muted-foreground">Adresse</Label>
                  <Input
                    id="edit-address"
                    value={editingClient?.address || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                    placeholder="Libreville, Gabon"
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-4">
                  Enregistrer les modifications
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border text-foreground w-full md:max-w-md"
          />
        </div>
        <ViewFormatSelector
          currentFormat={viewFormat.clients}
          onFormatChange={(format: 'table' | 'horizontal' | 'block') => setViewFormat('clients', format)}
        />
      </div>

      {viewFormat.clients === 'table' && (
        <div className="flex-1 min-h-0 bg-card rounded-xl border border-border overflow-auto shadow-sm">
          <table className="w-full min-w-[600px]">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Client</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Téléphone</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Statut</th>
                <th className="text-right p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {paginatedClients.map((client) => (
                <tr key={client.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8 ring-1 ring-border">
                        <AvatarFallback className="bg-gradient-to-br from-primary/80 to-accent text-primary-foreground text-xs font-semibold">
                          {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-bold text-sm">{client.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{client.email}</td>
                  <td className="p-4 text-sm text-muted-foreground">{client.phone}</td>
                  <td className="p-4">
                    <Badge variant={client.status === 'active' ? 'default' : client.status === 'warning' ? 'secondary' : 'outline'}>
                      {client.status === 'active' ? 'Actif' : client.status === 'warning' ? 'Attention' : 'Inactif'}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 bg-card border-border">
                        {user?.role === 'user' && (
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
                        {(user?.role === 'admin' || user?.role === 'user') && (
                          <DropdownMenuItem
                            className="gap-2 text-destructive focus:text-destructive"
                            onClick={() => handleDelete(client.id)}
                          >
                            <Trash2 className="w-4 h-4" /> Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {paginatedClients.length === 0 && (
            <div className="p-8 text-center">
              <EmptyState
                icon={Users}
                title={searchQuery ? "Aucun client trouvé" : "Base clients vide"}
                description={searchQuery ? "Aucun client ne correspond à votre recherche." : "Ajoutez votre premier client pour commencer à générer des devis."}
                actionLabel={!searchQuery && user?.role === 'user' ? "Nouveau client" : undefined}
                onAction={!searchQuery && user?.role === 'user' ? () => setIsAddDialogOpen(true) : undefined}
              />
            </div>
          )}
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
                      <p className="text-xs text-muted-foreground">{client.email} • {client.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={client.status === 'active' ? 'default' : client.status === 'warning' ? 'secondary' : 'outline'}>
                      {client.status === 'active' ? 'Actif' : client.status === 'warning' ? 'Attention' : 'Inactif'}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 bg-card border-border">
                        {user?.role === 'user' && (
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
                        {(user?.role === 'admin' || user?.role === 'user') && (
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
              actionLabel={!searchQuery && user?.role === 'user' ? "Nouveau client" : undefined}
              onAction={!searchQuery && user?.role === 'user' ? () => setIsAddDialogOpen(true) : undefined}
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
                          {user?.role === 'user' && (
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
                          {(user?.role === 'admin' || user?.role === 'user') && (
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
                        <MapPin className="w-3.5 h-3.5 text-primary/40" />
                        <span className="truncate font-medium">{client.address || 'Libreville, Gabon'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-secondary/30 px-4 py-2 border-t border-border/50 flex items-center justify-between">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Chiffre d'Affaires</div>
                    <div className="font-semibold text-foreground text-sm tracking-tighter">
                      {formatCurrency(useStore.getState().invoices
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
                actionLabel={!searchQuery && user?.role === 'user' ? "Nouveau client" : undefined}
                onAction={!searchQuery && user?.role === 'user' ? () => setIsAddDialogOpen(true) : undefined}
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
    </div>
  )
}
