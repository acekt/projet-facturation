"use client"

import * as React from "react"
import { Plus, DownloadCloud, ShieldAlert } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { useStore, type Service } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { toast } from "sonner"
import { escapeCsvCell } from "@/lib/utils"
import { Pagination } from "@workspace/ui/components/pagination-custom"
import { createService, updateService as updateServiceAction, deleteService } from "@/app/actions/service.actions"
import { PageHeader } from "@workspace/ui/components/page-header"
import { SearchBar } from "@workspace/ui/components/search-bar"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { ServiceFormDialog, type ServiceFormData } from "./services/ServiceFormDialog"
import { ServiceDeleteDialog } from "./services/ServiceDeleteDialog"
import { ServiceDetailsDialog } from "./services/ServiceDetailsDialog"
import { ServiceViews } from "./services/ServiceViews"
import { useCommandFilter } from "@/lib/command-navigation"

const INITIAL_SERVICE_FORM: ServiceFormData = {
  name: "",
  description: "",
  category: "Prestation de services",
  unitPrice: 0,
}

export function ServicesPage() {
  const {
    services,
    addService,
    removeService,
    updateService,
    user,
    viewFormat,
    isDataLoaded,
  } = useStore(
    useShallow((state) => ({
      services: state.services,
      addService: state.addService,
      removeService: state.removeService,
      updateService: state.updateService,
      user: state.user,
      viewFormat: state.viewFormat,
      isDataLoaded: state.isDataLoaded,
    }))
  )

  const [searchQuery, setSearchQuery] = React.useState("")
  useCommandFilter("services", setSearchQuery)
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 9 // Grid 3x3

  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingService, setEditingService] = React.useState<Service | null>(null)
  const [serviceToDeleteId, setServiceToDeleteId] = React.useState<string | null>(null)
  const [selectedService, setSelectedService] = React.useState<Service | null>(null)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formData, setFormData] = React.useState<ServiceFormData>(INITIAL_SERVICE_FORM)

  const filteredServices = React.useMemo(() => {
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.category ?? "").toLowerCase().includes(searchQuery.toLowerCase())
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

  const handleOpenCreate = () => {
    setEditingService(null)
    setFormData(INITIAL_SERVICE_FORM)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (service: Service) => {
    setEditingService(service)
    setFormData({
      name: service.name,
      description: service.description || "",
      category: service.category || "Prestation de services",
      unitPrice: service.unitPrice,
    })
    setIsDialogOpen(true)
  }

  const handleOpenDetails = (service: Service) => {
    setSelectedService(service)
    setIsDetailsDialogOpen(true)
  }

  const handleExportCsv = () => {
    const headers = ["Désignation", "Catégorie", "Prix unitaire (XAF)", "Description"]
    const targetList = searchQuery.trim() ? filteredServices : services
    const rows = targetList.map((s) => [
      escapeCsvCell(s.name),
      escapeCsvCell(s.category || ""),
      escapeCsvCell(s.unitPrice),
      escapeCsvCell(s.description || ""),
    ])
    const csvContent = [headers.map(escapeCsvCell).join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute("download", `catalogue_services_${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!formData.name.trim()) {
      toast.error("Le nom du service est requis.")
      return
    }

    const price = Number(formData.unitPrice)
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Le prix unitaire doit être un nombre positif ou nul.")
      return
    }

    const validatedData = { ...formData, unitPrice: price }

    if (editingService) {
      const originalService = services.find((s) => s.id === editingService.id)

      setIsSubmitting(true)
      try {
        const response = await updateServiceAction(editingService.id, validatedData)
        if (!response.success) {
          if (response.error === "Forbidden") {
            toast.error("Action refusée : Ce service est protégé ou vous manquez de droits.")
            return
          }
          throw new Error(response.error)
        }

        updateService(editingService.id, response.data)
        setIsDialogOpen(false)
        setEditingService(null)
        toast.success("Service mis à jour")
      } catch (error) {
        if (originalService) updateService(editingService.id, originalService)
        const msg = error instanceof Error ? error.message : "Erreur inconnue"
        toast.error(`Échec de la modification : ${msg}`)
      } finally {
        setIsSubmitting(false)
      }
    } else {
      const tempId = crypto.randomUUID()
      const serviceToCreate: Service = {
        id: tempId,
        name: validatedData.name.trim(),
        description: validatedData.description?.trim() || "",
        category: validatedData.category,
        unitPrice: validatedData.unitPrice,
      }

      setIsSubmitting(true)
      try {
        const response = await createService(serviceToCreate)
        if (!response.success) {
          if (response.error === "Forbidden") {
            toast.error("Action refusée : Ce service est protégé ou vous manquez de droits.")
            return
          }
          throw new Error(response.error)
        }

        addService(response.data)
        setIsDialogOpen(false)
        setFormData(INITIAL_SERVICE_FORM)
        toast.success("Service ajouté au catalogue")
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Erreur inconnue"
        toast.error(`Échec de l'ajout : ${msg}`)
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (isSubmitting) return

    const serviceToRestore = services.find((s) => s.id === id)
    removeService(id)
    toast.success("Service supprimé")
    setServiceToDeleteId(null)

    setIsSubmitting(true)
    try {
      const response = await deleteService(id)
      if (!response.success) {
        if (response.error === "Forbidden") {
          if (serviceToRestore) addService(serviceToRestore)
          toast.error("Action refusée : Ce service est protégé ou vous manquez de droits.")
          return
        }
        throw new Error(response.error)
      }
    } catch (error) {
      if (serviceToRestore) addService(serviceToRestore)
      const msg = error instanceof Error ? error.message : "Erreur inconnue"
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
          {user?.role !== "admin" && (
            <Alert
              variant="default"
              className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50 mb-6"
            >
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="font-medium">
                Vous êtes en mode lecture seule (Opérateur). Seul un Administrateur peut modifier ces paramètres.
              </AlertDescription>
            </Alert>
          )}

          <PageHeader
            title="Catalogue de Services"
            description="Gérez les prestations et tarifs standards de votre entreprise"
            actions={
              <>
                <Button variant="outline" onClick={handleExportCsv} className="gap-2 hidden sm:flex">
                  <DownloadCloud className="w-4 h-4" />
                  Export CSV
                </Button>
                {user?.role === "admin" && (
                  <Button variant="primary-shadow" className="gap-2" onClick={handleOpenCreate}>
                    <Plus className="w-4 h-4" />
                    Nouveau service
                  </Button>
                )}
              </>
            }
          />

          <SearchBar
            placeholder="Rechercher un service ou catégorie..."
            value={searchQuery}
            onChange={setSearchQuery}
            viewFormatKey="services"
          />

          <ServiceViews
            services={paginatedServices}
            viewFormat={viewFormat.services || "table"}
            user={user}
            searchQuery={searchQuery}
            onViewDetails={handleOpenDetails}
            onEdit={handleOpenEdit}
            onDelete={(id) => setServiceToDeleteId(id)}
            onOpenCreate={handleOpenCreate}
          />

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />

          <ServiceFormDialog
            isOpen={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            isEdit={editingService !== null}
            formData={formData}
            onChange={setFormData}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />

          <ServiceDeleteDialog
            serviceId={serviceToDeleteId}
            onOpenChange={(open) => !open && setServiceToDeleteId(null)}
            onConfirm={handleDelete}
            isSubmitting={isSubmitting}
          />

          <ServiceDetailsDialog
            isOpen={isDetailsDialogOpen}
            onOpenChange={setIsDetailsDialogOpen}
            service={selectedService}
            user={user}
            onEdit={handleOpenEdit}
          />
        </div>
      )}
    </>
  )
}
