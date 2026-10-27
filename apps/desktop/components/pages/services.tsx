"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Plus, MoreVertical, Edit2, Trash2, Briefcase, Tag, DownloadCloud, Eye, Info } from "lucide-react"
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

export const PREDEFINED_SERVICE_CATEGORIES = [
  "Prestation de services",
  "Conseil & Expertise",
  "Développement & IT",
  "Maintenance & Support",
  "Formation & Coaching",
  "Design & Communication",
  "Logistique & Transport",
  "BTP & Travaux",
  "Fournitures & Équipements",
  "Autre prestation",
] as const;
import { useStore, type Service } from "@/lib/store"
import { toast } from "sonner"
import { formatCurrency, escapeCsvCell } from "@/lib/utils"
import { Pagination } from "@workspace/ui/components/pagination-custom"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { createService, updateService as updateServiceAction, deleteService } from "@/app/actions/service.actions"
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
  AmountCell,
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
  const isDataLoaded = useStore((state) => state.isDataLoaded)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 9 // Grid 3x3
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingService, setEditingService] = React.useState<Service | null>(null)
  const [serviceToDeleteId, setServiceToDeleteId] = React.useState<string | null>(null)
  const [selectedService, setSelectedService] = React.useState<Service | null>(null)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    category: "Prestation de services",
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

    if (formData.unitPrice < 0) {
      toast.error("Le prix unitaire ne peut pas être négatif.")
      return
    }

    if (editingService) {
      const originalService = services.find(s => s.id === editingService.id)

      setIsSubmitting(true)
      try {
        const response = await updateServiceAction(editingService.id, formData)
        
        if (!response.success) {
          if (response.error === 'Forbidden') {
            toast.error("Action refusée : Ce service est protégé ou vous manquez de droits.")
            return
          }
          throw new Error(response.error)
        }

        const updatedService = response.data

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
        const response = await createService(serviceToCreate)
        if (!response.success) {
          if (response.error === 'Forbidden') {
            toast.error("Action refusée : Ce service est protégé ou vous manquez de droits.")
            return
          }
          throw new Error(response.error)
        }
        const created = response.data
        // Use confirmed server record — form resets only on success
        addService(created)
        setIsDialogOpen(false)
        setFormData({ name: "", description: "", category: "Prestation de services", unitPrice: 0 })
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
      const response = await deleteService(id)
      if (!response.success) {
        if (response.error === 'Forbidden') {
          if (serviceToRestore) addService(serviceToRestore)
          toast.error("Action refusée : Ce service est protégé ou vous manquez de droits.")
          return
        }
        throw new Error(response.error)
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
    <>
      {!isDataLoaded ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground font-medium">Chargement des services...</p>
          </div>
        </div>
      ) : (
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
                const targetList = searchQuery.trim() ? filteredServices : services;
                const rows = targetList.map(s => [
                  escapeCsvCell(s.name),
                  escapeCsvCell(s.category || ''),
                  escapeCsvCell(s.description || ''),
                  escapeCsvCell(s.unitPrice)
                ]);
                const csvContent = [headers.map(escapeCsvCell).join(","), ...rows.map(r => r.join(","))].join("\n");
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
                  setFormData({ name: "", description: "", category: "Prestation de services", unitPrice: 0 })
                  setIsDialogOpen(true)
                }}
                variant="primary-shadow"
                className="gap-2"
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
                    <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-lg">
                      <DropdownMenuItem
                        className="gap-2 cursor-pointer font-medium"
                        onClick={() => {
                          setSelectedService(service)
                          setIsDetailsDialogOpen(true)
                        }}
                      >
                        <Eye className="w-4 h-4 text-primary" /> Voir les détails
                      </DropdownMenuItem>
                      {user?.role === 'admin' && (
                        <>
                          <DropdownMenuSeparator className="bg-border/60" />
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => {
                              setEditingService(service)
                              setFormData({
                                  name: service.name,
                                  description: service.description || "",
                                  category: service.category || "Prestation de services",
                                  unitPrice: service.unitPrice
                              })
                              setIsDialogOpen(true)
                          }}>
                            <Edit2 className="w-4 h-4" /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                            onClick={() => setServiceToDeleteId(service.id)}
                          >
                            <Trash2 className="w-4 h-4" /> Supprimer
                          </DropdownMenuItem>
                        </>
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
                      <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-lg">
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer font-medium"
                          onClick={() => {
                            setSelectedService(service)
                            setIsDetailsDialogOpen(true)
                          }}
                        >
                          <Eye className="w-4 h-4 text-primary" /> Voir les détails
                        </DropdownMenuItem>
                        {user?.role === 'admin' && (
                          <>
                            <DropdownMenuSeparator className="bg-border/60" />
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => {
                                setEditingService(service)
                                setFormData({
                                    name: service.name,
                                    description: service.description || "",
                                    category: service.category || "Prestation de services",
                                    unitPrice: service.unitPrice
                                })
                                setIsDialogOpen(true)
                            }}>
                              <Edit2 className="w-4 h-4" /> Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive cursor-pointer" onClick={() => setServiceToDeleteId(service.id)}>
                              <Trash2 className="w-4 h-4" /> Supprimer
                            </DropdownMenuItem>
                          </>
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
                        <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-lg">
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer font-medium"
                            onClick={() => {
                              setSelectedService(service)
                              setIsDetailsDialogOpen(true)
                            }}
                          >
                            <Eye className="w-4 h-4 text-primary" /> Voir les détails
                          </DropdownMenuItem>
                          {user?.role === 'admin' && (
                            <>
                              <DropdownMenuSeparator className="bg-border/60" />
                              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => {
                                  setEditingService(service)
                                  setFormData({
                                      name: service.name,
                                      description: service.description || "",
                                      category: service.category || "Prestation de services",
                                      unitPrice: service.unitPrice
                                  })
                                  setIsDialogOpen(true)
                              }}>
                                <Edit2 className="w-4 h-4" /> Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive cursor-pointer" onClick={() => setServiceToDeleteId(service.id)}>
                                <Trash2 className="w-4 h-4" /> Supprimer
                              </DropdownMenuItem>
                            </>
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
        <DialogContent className="bg-card border-border" side="right">
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
              <Label htmlFor="service-name" className="text-muted-foreground">Nom du service / prestation <span className="text-destructive">*</span></Label>
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
                <Label htmlFor="service-category" className="text-muted-foreground">Catégorie <span className="text-destructive">*</span></Label>
                <Select
                  value={formData.category || "Prestation de services"}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="service-category" className="w-full bg-secondary border-border text-foreground">
                    <SelectValue placeholder="Choisir une catégorie" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {PREDEFINED_SERVICE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                    {formData.category && !PREDEFINED_SERVICE_CATEGORIES.includes(formData.category as any) && (
                      <SelectItem value={formData.category}>
                        {formData.category}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-price" className="text-muted-foreground">Prix Unitaire (XAF) <span className="text-destructive">*</span></Label>
                <Input
                  id="service-price"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: parseInt(e.target.value, 10) || 0 })}
                  className="bg-secondary border-border text-right"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-description" className="text-muted-foreground">Description <span className="text-xs text-muted-foreground/60">(optionnel)</span></Label>
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
      {/* ── Dialog Détails du Service (Lecture Seule & Consultation) ── */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-foreground text-base font-bold truncate">
                  {selectedService?.name}
                </DialogTitle>
                <div className="mt-1">
                  <StatusBadge
                    variant="neutral"
                    label={selectedService?.category || "Non classé"}
                  />
                </div>
              </div>
            </div>
            <VisuallyHidden>
              <DialogDescription>Détails complets de la prestation du catalogue</DialogDescription>
            </VisuallyHidden>
          </DialogHeader>

          {selectedService && (
            <div className="space-y-4 py-2 text-sm">
              <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tarif standard appliqué
                  </div>
                  <div className="text-2xl font-extrabold text-foreground mt-0.5">
                    {formatCurrency(selectedService.unitPrice)}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Tag className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-primary" /> Description de la prestation
                </div>
                {selectedService.description?.trim() ? (
                  <div className="p-3.5 rounded-lg bg-secondary/20 border border-border/50 text-foreground text-xs leading-relaxed whitespace-pre-wrap">
                    {selectedService.description.trim()}
                  </div>
                ) : (
                  <div className="py-4 px-3 rounded-lg bg-secondary/10 border border-dashed border-border/60 text-xs text-muted-foreground/70 italic text-center">
                    Aucune description complémentaire enregistrée pour ce service.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>
                  Fermer
                </Button>
                {user?.role === 'admin' && (
                  <Button
                    variant="default"
                    className="gap-1.5"
                    onClick={() => {
                      setIsDetailsDialogOpen(false)
                      setEditingService(selectedService)
                      setFormData({
                        name: selectedService.name,
                        description: selectedService.description || "",
                        category: selectedService.category || "Prestation de services",
                        unitPrice: selectedService.unitPrice,
                      })
                      setIsDialogOpen(true)
                    }}
                  >
                    <Edit2 className="w-4 h-4" /> Modifier
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
