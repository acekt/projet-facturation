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
  DialogDescription,
} from "@/components/ui/dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useStore, type Service } from "@/lib/store"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { Pagination } from "@/components/ui/pagination-custom"
import { EmptyState } from "@/components/ui/empty-state"
import { ViewFormatSelector } from "@/components/ui/view-format-selector"
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

export function ServicesPage() {
  const services = useStore((state) => state.services)
  const setServices = useStore((state) => state.setServices)
  const user = useStore((state) => state.user)
  const viewFormat = useStore((state) => state.viewFormat)
  const setViewFormat = useStore((state) => state.setViewFormat)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 9 // Grid 3x3
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingService, setEditingService] = React.useState<Service | null>(null)
  const [serviceToDeleteId, setServiceToDeleteId] = React.useState<string | null>(null)
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
        (s.category ?? '').toLowerCase().includes(searchQuery.toLowerCase())
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
    const previousServices = [...services]

    if (editingService) {
      // Modification
      const updatedService: Service = {
        ...editingService,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        unitPrice: formData.unitPrice,
      }

      // Optimistic Update
      setServices(services.map(s => s.id === editingService.id ? updatedService : s))
      setIsDialogOpen(false)
      toast.success("Service mis à jour")

      try {
        const response = await fetch(`/api/services/${editingService.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (!response.ok) throw new Error('Failed to update service')
      } catch (error) {
        // Rollback on failure
        setServices(previousServices)
        toast.error("Erreur lors de la modification du service. Annulation.")
      }
    } else {
      // Ajout
      const tempId = crypto.randomUUID()
      const serviceToCreate: Service = {
        id: tempId,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        unitPrice: formData.unitPrice,
      }

      // Optimistic Update
      setServices([...services, serviceToCreate])
      setIsDialogOpen(false)
      setFormData({ name: "", description: "", category: "", unitPrice: 0 })
      toast.success("Service ajouté au catalogue")

      try {
        const response = await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serviceToCreate),
        })
        if (!response.ok) throw new Error('Failed to create service')
        const created = await response.json()
        setServices(previousServices.concat(created))
      } catch (error) {
        // Rollback on failure
        setServices(previousServices)
        toast.error("Erreur lors de l'ajout du service. Annulation.")
      }
    }
  }

  const handleDelete = async (id: string) => {
    const previousServices = [...services]

    // Optimistic Update
    setServices(services.filter(s => s.id !== id))
    toast.success("Service supprimé")
    setServiceToDeleteId(null)

    try {
      const response = await fetch(`/api/services/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Delete failed')
    } catch (error) {
      // Rollback on failure
      setServices(previousServices)
      toast.error("Erreur lors de la suppression du service. Restauration.")
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden space-y-6">
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
        <ViewFormatSelector
          currentFormat={viewFormat.services || 'block'}
          onFormatChange={(format: 'table' | 'horizontal' | 'block') => setViewFormat('services', format)}
        />
      </div>

      {(!viewFormat.services || viewFormat.services === 'table') && (
        <div className="flex-1 min-h-0 bg-card rounded-xl border border-border overflow-auto shadow-sm">
          <table className="w-full min-w-[600px]">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Service</th>
                <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Catégorie</th>
                <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                <th className="text-right p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prix</th>
                <th className="text-right p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {paginatedServices.length > 0 ? paginatedServices.map((service) => (
                <tr key={service.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-sm max-w-[200px] sm:max-w-[300px] truncate" title={service.name}>
                        {service.name}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant="secondary" className="max-w-[150px] truncate" title={service.category || 'Non classé'}>
                      {service.category || 'Non classé'}
                    </Badge>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    <div className="max-w-[300px] truncate" title={service.description || undefined}>
                      {service.description || <span className="text-muted-foreground/50">—</span>}
                    </div>
                  </td>
                  <td className="p-4 text-right font-bold text-sm">{formatCurrency(service.unitPrice)}</td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
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
                        {(user?.role === 'admin' || user?.role === 'user') && (
                          <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setServiceToDeleteId(service.id)}>
                            <Trash2 className="w-4 h-4" /> Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )) : null}
            </tbody>
          </table>
          {paginatedServices.length === 0 && (
            <div className="p-8 text-center">
              <EmptyState
                icon={Briefcase}
                title={searchQuery ? "Aucun service trouvé" : "Catalogue vide"}
                description={searchQuery ? "Aucun service ne correspond à votre recherche dans le catalogue." : "Enregistrez vos prestations habituelles pour gagner du temps lors de la création de devis."}
                actionLabel={!searchQuery && user?.role === 'user' ? "Nouveau service" : undefined}
                onAction={!searchQuery && user?.role === 'user' ? () => setIsDialogOpen(true) : undefined}
              />
            </div>
          )}
        </div>
      )}

      {viewFormat.services === 'horizontal' && (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <div className="space-y-3">
          {paginatedServices.length > 0 ? paginatedServices.map((service) => (
            <Card key={service.id} className="bg-card border-border hover:border-primary/30 transition-all group shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{service.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px]">{service.category || 'Non classé'}</Badge>
                        <span className="text-xs text-muted-foreground">{formatCurrency(service.unitPrice)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
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
                        {(user?.role === 'admin' || user?.role === 'user') && (
                          <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setServiceToDeleteId(service.id)}>
                            <Trash2 className="w-4 h-4" /> Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          )) : null}
          {paginatedServices.length === 0 && (
            <EmptyState
              icon={Briefcase}
              title={searchQuery ? "Aucun service trouvé" : "Catalogue vide"}
              description={searchQuery ? "Aucun service ne correspond à votre recherche dans le catalogue." : "Enregistrez vos prestations habituelles pour gagner du temps lors de la création de devis."}
              actionLabel={!searchQuery && user?.role === 'user' ? "Nouveau service" : undefined}
              onAction={!searchQuery && user?.role === 'user' ? () => setIsDialogOpen(true) : undefined}
            />
          )}
        </div>
        </div>
      )}

      {viewFormat.services === 'block' && (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedServices.length > 0 ? paginatedServices.map((service, index) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-card border-border hover:border-primary/30 transition-all group overflow-hidden shadow-sm">
                <CardContent className="p-0">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Briefcase className="w-5 h-5" />
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
                          {(user?.role === 'admin' || user?.role === 'user') && (
                            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setServiceToDeleteId(service.id)}>
                              <Trash2 className="w-4 h-4" /> Supprimer
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <h3 className="font-semibold text-foreground text-sm mb-1 truncate uppercase tracking-tighter">{service.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-3 h-3 text-primary/40" />
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{service.category || 'Non classé'}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 h-8 mb-3 leading-relaxed">
                      {service.description || "Aucune description fournie."}
                    </p>
                  </div>
                  <div className="bg-secondary/30 px-4 py-2 border-t border-border/50 flex items-center justify-between">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Tarif Standard</div>
                    <div className="font-semibold text-foreground text-sm tracking-tighter">{formatCurrency(service.unitPrice)}</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )) : null}
          {paginatedServices.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={Briefcase}
                title={searchQuery ? "Aucun service trouvé" : "Catalogue vide"}
                description={searchQuery ? "Aucun service ne correspond à votre recherche dans le catalogue." : "Enregistrez vos prestations habituelles pour gagner du temps lors de la création de devis."}
                actionLabel={!searchQuery && user?.role === 'user' ? "Nouveau service" : undefined}
                onAction={!searchQuery && user?.role === 'user' ? () => setIsDialogOpen(true) : undefined}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingService ? "Modifier le service" : "Ajouter un nouveau service"}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>Formulaire pour enregistrer les informations d'un service dans le catalogue</DialogDescription>
            </VisuallyHidden>
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
      <AlertDialog open={serviceToDeleteId !== null} onOpenChange={(open) => !open && setServiceToDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce service du catalogue ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => serviceToDeleteId && handleDelete(serviceToDeleteId)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
