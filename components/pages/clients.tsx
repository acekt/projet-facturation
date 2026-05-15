"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  Search,
  Plus,
  MoreHorizontal,
  Mail,
  Phone,
  MapPin,
  Eye,
  Edit,
  Trash2,
  FileText,
  Users,
  TrendingUp,
  Receipt,
  Clock,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

import { useStore } from "@/lib/store"
import { toast } from "sonner"
import { clientSchema } from "@/lib/validations"
import { formatShortCurrency } from "@/lib/utils"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export function ClientsPage() {
  const { clients, addClient, deleteClient } = useStore()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [newClientOpen, setNewClientOpen] = React.useState(false)
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  })

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAddClient = () => {
    const result = clientSchema.safeParse(formData)

    if (!result.success) {
      toast.error(result.error.errors[0].message)
      return
    }

    addClient(result.data)
    setNewClientOpen(false)
    setFormData({ name: "", email: "", phone: "", address: "" })
    toast.success("Client ajouté avec succès")
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">Gerez vos clients et leur historique de paiement</p>
        </div>
        <Dialog open={newClientOpen} onOpenChange={setNewClientOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4" />
              Nouveau client
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Ajouter un client</DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Nom de l&apos;entreprise</Label>
                <Input
                  placeholder="Societe XYZ"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Email</Label>
                <Input
                  type="email"
                  placeholder="contact@entreprise.ga"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Telephone</Label>
                <Input
                  placeholder="+241 01 XX XX XX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Adresse</Label>
                <Input
                  placeholder="Libreville, Gabon"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 border-border"
                  onClick={() => setNewClientOpen(false)}
                >
                  Annuler
                </Button>
                <Button 
                  onClick={handleAddClient}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Ajouter
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total clients</p>
                <p className="text-2xl font-bold text-foreground">{clients.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Revenu total</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatShortCurrency(clients.reduce((acc, c) => acc + c.totalRevenue, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Delai moyen</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {clients.length > 0 ? Math.round(clients.reduce((acc, c) => acc + c.avgPaymentDays, 0) / clients.length) : 0} jours
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Factures totales</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {clients.reduce((acc, c) => acc + c.invoiceCount, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un client..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      {/* Clients Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {filteredClients.map((client) => (
          <motion.div key={client.id} variants={itemVariants}>
            <Card className="bg-card border-border overflow-hidden group hover:shadow-lg hover:border-primary/20 transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 ring-2 ring-border">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-semibold">
                        {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-foreground font-semibold">{client.name}</h3>
                      <p className="text-muted-foreground text-sm flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {client.address}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Options du client"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border">
                      <DropdownMenuItem className="gap-2 cursor-pointer">
                        <Eye className="w-4 h-4" />
                        Voir le profil
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 cursor-pointer">
                        <Edit className="w-4 h-4" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 cursor-pointer">
                        <FileText className="w-4 h-4" />
                        Creer une facture
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => {
                          deleteClient(client.id)
                          toast.success("Client supprime")
                        }}
                        className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{client.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Phone className="w-4 h-4" />
                    <span>{client.phone}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
                  <div className="text-center">
                    <p className="text-foreground font-bold">{formatShortCurrency(client.totalRevenue)}</p>
                    <p className="text-muted-foreground text-xs">CA Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-foreground font-bold">{client.invoiceCount}</p>
                    <p className="text-muted-foreground text-xs">Factures</p>
                  </div>
                  <div className="text-center">
                    <p className={`font-bold ${client.avgPaymentDays > 30 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {client.avgPaymentDays}j
                    </p>
                    <p className="text-muted-foreground text-xs">Delai moy.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  )
}
