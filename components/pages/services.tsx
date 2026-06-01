"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Plus, Search, MoreVertical, Edit2, Trash2, Briefcase, Tag } from "lucide-react"
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
import { useStore } from "@/lib/store"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { Pagination } from "@/components/ui/pagination-custom"

export function ServicesPage() {
  const services = useStore((state) => state.services)
  const setServices = useStore((state) => state.setServices)
  const user = useStore((state) => state.user)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 9 // Grid 3x3
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingService, setEditingService] = React.useState<any | null>(null)
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    category: "",
    unitPrice: 0,
  })

  const filteredServices = React.useMemo(() => {
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [services, searchQuery])

  const totalPages = Math.ceil(filteredServices.length / itemsPerPage)
  const paginatedServices = filteredServices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingService ? `/api/services/${editingService.id}` : '/api/services'
      const method = editingService ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to save service')

      const updated = await fetch('/api/services').then(res => res.json())
      setServices(updated)

      setIsDialogOpen(false)
      setEditingService(null)
      setFormData({ name: "", description: "", category: "", unitPrice: 0 })
      toast.success(editingService ? "Service mis à jour" : "Service ajouté au catalogue")
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce service du catalogue ?")) return
    try {
      const response = await fetch(`/api/services/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Delete failed')
      toast.success("Service supprimé")
      const updated = await fetch('/api/services').then(res => res.json())
      setServices(updated)
    } catch (error) {
      toast.error("Erreur lors de la suppression")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Catalogue de Services</h1>
          <p className="text-muted-foreground mt-1">Gérez vos prestations et tarifs standardisés</p>
        </div>
        {user?.role === 'user' && (
          <Button
            onClick={() => {
              setEditingService(null)
              setFormData({ name: "", description: "", category: "", unitPrice: 0 })
              setIsDialogOpen(true)
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Nouveau service
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un service ou catégorie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border text-foreground w-full md:max-w-md"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedServices.map((service, index) => (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="bg-card border-border hover:border-primary/30 transition-all group overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 bg-card border-border">
                        {user?.role === 'user' && (
                          <DropdownMenuItem className="gap-2" onClick={() => {
                              setEditingService(service)
                              setFormData({
                                  name: service.name,
                                  description: service.description || "",
                                  category: service.category || "",
                                  unitPrice: service.unitPrice
                              })
                              setIsDialogOpen(true)
                          }}>
                            <Edit2 className="w-4 h-4" /> Modifier
                          </DropdownMenuItem>
                        )}
                        {user?.role === 'admin' && (
                          <DropdownMenuItem className="gap-2 text-destructive" onClick={() => handleDelete(service.id)}>
                            <Trash2 className="w-4 h-4" /> Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-1 truncate">{service.name}</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-3.5 h-3.5 text-primary/60" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{service.category || 'Non classé'}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 h-10 mb-4">
                    {service.description || "Aucune description fournie."}
                  </p>
                </div>
                <div className="bg-secondary/30 p-4 border-t border-border flex items-center justify-between">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Prix Unitaire</div>
                  <div className="font-bold text-foreground text-lg">{formatCurrency(service.unitPrice)}</div>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingService ? "Modifier le service" : "Ajouter un nouveau service"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="service-name" className="text-muted-foreground">Nom du service</Label>
              <Input
                id="service-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Audit de sécurité réseau"
                className="bg-secondary border-border"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service-category" className="text-muted-foreground">Catégorie</Label>
                <Input
                  id="service-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Ex: Conseil"
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-price" className="text-muted-foreground">Prix Unitaire (XAF)</Label>
                <Input
                  id="service-price"
                  type="number"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                  className="bg-secondary border-border text-right"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-description" className="text-muted-foreground">Description</Label>
              <Input
                id="service-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Détails du service..."
                className="bg-secondary border-border"
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-4 h-11">
              Enregistrer dans le catalogue
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
