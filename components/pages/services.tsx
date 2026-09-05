"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Plus, MoreVertical, Edit2, Trash2, Briefcase, Tag, DownloadCloud } from "lucide-react"
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
import { useStore, type Service } from "@/lib/store"
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
  AmountCell,
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

export function ServicesPage() {
  const services = useStore((state) => state.services)
  const setServices = useStore((state) => state.setServices)
  const addService = useStore((state) => state.addService)
  const removeService = useStore((state) => state.removeService)
  const updateService = useStore((state) => state.updateService)
  const replaceService = useStore((state) => state.replaceService)
  const user = useStore((state) => state.user)
  const viewFormat = useStore((state) => state.viewFormat)
  const setViewFormat = useStore((state) => state.setViewFormat)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 9 // Grid 3x3
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingService, setEditingService] = React.useState<Service | null>(null)
  const [serviceToDeleteId, setServiceToDeleteId] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
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
    if (isSubmitting) return

    if (!formData.name) {
      toast.error("Le nom du service est requis.")
      return
    }

    if (editingService) {
      const originalService = services.find(s => s.id === editingService.id)

      setIsSubmitting(true)
      try {
        const response = await fetch(`/api/services/${editingService.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (response.status === 403) {
          toast.error("Action refusée : Ce service est protégé ou vous manquez de droits.")
          return
        }
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.error || `HTTP ${response.status}`)
        }

        const updatedService = await response.json()

        // Apply update only after server confirms
        updateService(editingService.id, updatedService)
        setIsDialogOpen(false)
        toast.success("Service mis à jour")
      } catch (error) {
        if (originalService) updateService(editingService.id, originalService)
        const msg = error instanceof Error ? error.message : 'Erreur inconnue'
        toast.error(`Échec de la modification : ${msg}`)
      } finally {
        setIsSubmitting(false)
      }
    } else {
      const tempId = crypto.randomUUID()
      const serviceToCreate: Service = {
        id: tempId,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        unitPrice: formData.unitPrice,
      }

      setIsSubmitting(true)
      try {
        const response = await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serviceToCreate),
        })
        if (response.status === 403) {
          toast.error("Action refusée : Ce service est protégé ou vous manquez de droits.")
          return
        }
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.error || `HTTP ${response.status}`)
        }
        const created = await response.json()
        // Use confirmed server record — form resets only on success
        addService(created)
        setIsDialogOpen(false)
        setFormData({ name: "", description: "", category: "", unitPrice: 0 })
        toast.success("Service ajouté au catalogue")
      } catch (error) {
        // Form stays open — user can correct and retry
        const msg = error instanceof Error ? error.message : 'Erreur inconnue'
        toast.error(`Échec de l'ajout : ${msg}`)
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (isSubmitting) return;

    // Capture the service BEFORE removing it to enable precise rollback
    const serviceToRestore = services.find(s => s.id === id)

    removeService(id)
    toast.success("Service supprimé")
    setServiceToDeleteId(null)

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/services/${id}`, { method: 'DELETE' })
      if (response.status === 403) {
        if (serviceToRestore) addService(serviceToRestore)
        toast.error("Action refusée : Ce service est protégé ou vous manquez de droits.")
        return
      }
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${response.status}`)
      }
    } catch (error) {
      // ROLLBACK — re-insert the removed service
      if (serviceToRestore) addService(serviceToRestore)
      const msg = error instanceof Error ? error.message : 'Erreur inconnue'
      toast.error(`Échec de la suppression : ${msg}. Restauration effectuée.`)
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

      {/* ── En-tête de page (Design System) */}
      <PageHeader
        title="Catalogue de Services"
        description="Gérez vos prestations et tarifs standardisés"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                const headers = ["Service", "Categorie", "Description", "Prix unitaire"];
                const rows = paginatedServices.map(s => [s.name, s.category || '', s.description || '', s.unitPrice]);
                const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.setAttribute("download", `services_${new Date().toISOString().split('T')[0]}.csv`);
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
          </>
        }
      />

      {/* ── Barre de recherche (Design System) */}
      <SearchBar
        placeholder="Rechercher un service ou catégorie..."
        value={searchQuery}
        onChange={setSearchQuery}
        viewFormatKey="services"
      />

      {/* ── Vue Tableau (Design System) */}
      {(!viewFormat.services || viewFormat.services === 'table') && (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Service</DataTableHeaderCell>
              <DataTableHeaderCell>Catégorie</DataTableHeaderCell>
              <DataTableHeaderCell>Description</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Prix unitaire</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {paginatedServices.length > 0 ? paginatedServices.map((service) => (
              <DataTableRow key={service.id}>
                <DataTableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary/5 flex items-center justify-center text-primary flex-shrink-0">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-sm text-foreground max-w-[200px] sm:max-w-[300px] truncate" title={service.name}>
                      {service.name}
                    </span>
                  </div>
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge
                    variant="neutral"
                    label={service.category || 'Non classé'}
                    className="max-w-[150px] truncate"
                  />
                </DataTableCell>
                <DataTableCell truncate title={service.description || undefined}>
                  {service.description || <span className="text-muted-foreground/50">—</span>}
                </DataTableCell>
                <AmountCell amount={service.unitPrice} />
                <ActionsCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 bg-card border-border">
                      {user?.role === 'admin' && (
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
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive"
                          onClick={() => setServiceToDeleteId(service.id)}
                        >
                          <Trash2 className="w-4 h-4" /> Supprimer
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ActionsCell>
              </DataTableRow>
            )) : null}
          </DataTableBody>
        </DataTable>
      )}
      {(!viewFormat.services || viewFormat.services === 'table') && paginatedServices.length === 0 && (
        <div className="p-8 text-center">
          <EmptyState
            icon={Briefcase}
            title={searchQuery ? "Aucun service trouvé" : "Catalogue vide"}
            description={searchQuery ? "Aucun service ne correspond à votre recherche dans le catalogue." : "Enregistrez vos prestations habituelles pour gagner du temps lors de la création de devis."}
            actionLabel={!searchQuery && user?.role === 'admin' ? "Nouveau service" : undefined}
            onAction={!searchQuery && user?.role === 'admin' ? () => setIsDialogOpen(true) : undefined}
          />
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
                        <StatusBadge variant="neutral" label={service.category || 'Non classé'} />
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
                        {user?.role === 'admin' && (
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
              actionLabel={!searchQuery && user?.role === 'admin' ? "Nouveau service" : undefined}
              onAction={!searchQuery && user?.role === 'admin' ? () => setIsDialogOpen(true) : undefined}
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
                          {user?.role === 'admin' && (
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
                actionLabel={!searchQuery && user?.role === 'admin' ? "Nouveau service" : undefined}
                onAction={!searchQuery && user?.role === 'admin' ? () => setIsDialogOpen(true) : undefined}
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
                disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                disabled={isSubmitting}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-4 h-11"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Enregistrement..." : "Enregistrer dans le catalogue"}
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
            <AlertDialogCancel disabled={isSubmitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => serviceToDeleteId && handleDelete(serviceToDeleteId)}
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
