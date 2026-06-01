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
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useStore } from "@/lib/store"
import { toast } from "sonner"
import { DownloadCloud } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Pagination } from "@/components/ui/pagination-custom"

export function ClientsPage() {
  const { clients, setClients, invoices, user } = useStore()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 9 // Grid 3x3
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
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

  return (
    <div className="space-y-6">
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
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border text-foreground w-full md:max-w-md"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedClients.map((client, index) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="bg-card border-border hover:border-primary/30 transition-all group overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <Avatar className="w-12 h-12 ring-2 ring-border">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-lg font-bold">
                        {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
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
                          <DropdownMenuItem className="gap-2">
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
                  <h3 className="font-bold text-foreground text-lg mb-1 truncate">{client.name}</h3>
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-4 h-4 text-primary/60" />
                      <span className="truncate">{client.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4 text-primary/60" />
                      <span>{client.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 text-primary/60" />
                      <span className="truncate">{client.address}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-secondary/30 p-4 border-t border-border flex items-center justify-between">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">CA Total</div>
                  <div className="font-bold text-foreground">
                    {formatCurrency(useStore.getState().invoices
                      ?.filter(inv => inv.clientId === client.id && inv.status === 'PAID')
                      .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  )
}
