"use client"

import * as React from "react"
import { Plus, DownloadCloud, ShieldAlert } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { useStore, type Service } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { DataExportModal } from "@/components/features/export/DataExportModal"
import { Pagination } from "@workspace/ui/components/pagination-custom"
import { createService, updateService as updateServiceAction, deleteService } from "@/app/actions/service.actions"
import { PageHeader } from "@/components/features/common/PageHeader"
import { SearchBar } from "@workspace/ui/components/search-bar"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { ServiceFormDialog, type ServiceFormData } from "./services/ServiceFormDialog"
import { ServiceDeleteDialog } from "./services/ServiceDeleteDialog"
import { ServiceDetailsDialog } from "./services/ServiceDetailsDialog"
import { ServiceViews } from "./services/ServiceViews"
import { CreationSuccessModal } from "@/components/features/common/CreationSuccessModal"
import { useCommandFilter } from "@/lib/command-navigation"
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value"

const INITIAL_SERVICE_FORM: ServiceFormData = {
  name: "",
  description: "",
  category: "Prestation de services",
  unitPrice: 0,
  trackStock: 0,
  stockItemName: "",
  stockQuantity: 0,
  minStockAlert: 5,
  unit: "Unité",
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
  const debouncedSearch = useDebouncedValue(searchQuery, 200)
  useCommandFilter("services", setSearchQuery)
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 9 // Grid 3x3

  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingService, setEditingService] = React.useState<Service | null>(null)
  const [serviceToDeleteId, setServiceToDeleteId] = React.useState<string | null>(null)
  const [selectedService, setSelectedService] = React.useState<Service | null>(null)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = React.useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const submitLockRef = React.useRef(false)
  const [successModalData, setSuccessModalData] = React.useState<import("@/lib/store").Service | null>(null)
  const [successModalOpen, setSuccessModalOpen] = React.useState(false)
  const [formData, setFormData] = React.useState<ServiceFormData>(INITIAL_SERVICE_FORM)

  const filteredServices = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return services.filter(
      (s) =>
        !(s as any).deletedAt &&
        (s.name.toLowerCase().includes(q) ||
        (s.category ?? "").toLowerCase().includes(q))
    )
  }, [services, debouncedSearch])

  const totalPages = Math.ceil(filteredServices.length / itemsPerPage) || 1
  const safePage = Math.min(currentPage, Math.max(1, totalPages))
  const paginatedServices = filteredServices.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  )

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages))
    }
  }, [currentPage, totalPages])

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
      trackStock: Boolean(service.trackStock) ? 1 : 0,
      stockItemName: service.stockItemName || "",
      stockQuantity: service.stockQuantity ?? 0,
      minStockAlert: service.minStockAlert ?? 5,
      unit: service.unit || "Unité",
    })
    setIsDialogOpen(true)
  }

  const handleOpenDetails = (service: Service) => {
    setSelectedService(service)
    setIsDetailsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || submitLockRef.current) return

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
    submitLockRef.current = true

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
        void useStore.getState().refreshStockData(true)
        setIsDialogOpen(false)
        setEditingService(null)
        toast.success("Service mis à jour")
      } catch (error) {
        if (originalService) updateService(editingService.id, originalService)
        const msg = error instanceof Error ? error.message : "Erreur inconnue"
        toast.error(`Échec de la modification : ${msg}`)
      } finally {
        setIsSubmitting(false)
        submitLockRef.current = false
      }
    } else {
      const tempId = crypto.randomUUID()
      const serviceToCreate: Service = {
        id: tempId,
        name: validatedData.name.trim(),
        description: validatedData.description?.trim() || "",
        category: validatedData.category,
        unitPrice: validatedData.unitPrice,
        trackStock: validatedData.trackStock || 0,
        stockItemName: validatedData.stockItemName?.trim() || null,
        stockQuantity: validatedData.stockQuantity || 0,
        minStockAlert: validatedData.minStockAlert || 5,
        unit: validatedData.unit || "Unité",
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

        addService(response.data as Service)
        void useStore.getState().refreshStockData(true)
        setIsDialogOpen(false)
        setFormData(INITIAL_SERVICE_FORM)
        setSuccessModalData(response.data as Service)
        setSuccessModalOpen(true)
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Erreur inconnue"
        toast.error(`Échec de l'ajout : ${msg}`)
      } finally {
        setIsSubmitting(false)
        submitLockRef.current = false
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
        <div className="flex flex-col h-full overflow-hidden">
          <div className="shrink-0 pb-4 border-b border-border bg-background z-10 space-y-4">
            {user?.role !== "admin" && (
              <Alert
                variant="default"
                className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50"
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
                  <Button
                    variant="outline"
                    onClick={() => setIsExportModalOpen(true)}
                    className="gap-2 hidden sm:flex cursor-pointer"
                  >
                    <DownloadCloud className="w-4 h-4" /> Export Excel
                  </Button>
                  {user?.role === "admin" && (
                    <Button variant="primary-shadow" className="gap-2 cursor-pointer" onClick={handleOpenCreate}>
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
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 pt-4 pr-1 space-y-4">
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
          </div>

          <div className="shrink-0 pt-3 border-t border-border bg-background">
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>

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

          <CreationSuccessModal
            isOpen={successModalOpen}
            onOpenChange={setSuccessModalOpen}
            title="Service ajouté avec succès"
            subtitle={`La prestation ${successModalData?.name || "ce service"} a été enregistrée au catalogue.`}
            details={[
              { label: "Désignation", value: successModalData?.name || "—" },
              { label: "Catégorie", value: successModalData?.category || "—" },
              { label: "Tarif Standard", value: formatCurrency(successModalData?.unitPrice || 0), isAmount: true },
              {
                label: "Suivi de stock",
                value: successModalData?.trackStock
                  ? `Actif (${successModalData.stockQuantity || 0} ${successModalData.unit || "unités"})`
                  : "Désactivé",
              },
            ]}
            onClose={() => {
              setSuccessModalOpen(false)
              setSuccessModalData(null)
            }}
          />

          <DataExportModal
            open={isExportModalOpen}
            onOpenChange={setIsExportModalOpen}
            defaultScope="services"
            initialEntity="services"
          />
        </div>
      )}
    </>
  )
}
