"use client"

import * as React from "react"
import { Plus, DownloadCloud } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { useStore, type Client } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { toast } from "sonner"
import { DataExportModal } from "@/components/features/export/DataExportModal"
import { Pagination } from "@workspace/ui/components/pagination-custom"
import { createClient, updateClient as updateClientAction, deleteClient } from "@/app/actions/client.actions"
import { PageHeader } from "@/components/features/common/PageHeader"
import { SearchBar } from "@workspace/ui/components/search-bar"
import { ClientFormDialog, type ClientFormData } from "./clients/ClientFormDialog"
import { ClientDeleteDialog } from "./clients/ClientDeleteDialog"
import { ClientDetailsDialog } from "./clients/ClientDetailsDialog"
import { ClientViews } from "./clients/ClientViews"
import { CreationSuccessModal } from "@/components/features/common/CreationSuccessModal"
import { useCommandFilter } from "@/lib/command-navigation"
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value"

const INITIAL_CLIENT_FORM: ClientFormData = {
  name: "",
  email: "",
  phone: "",
  address: "",
  nif: "",
  rccm: "",
  status: "active",
}

const PHONE_REGEX = /^(\+?[0-9\s-]{6,25})$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateClientInput(data: ClientFormData): string | null {
  if (!data.name.trim()) {
    return "Le nom complet ou la raison sociale est requis."
  }
  if (!data.phone || !data.phone.trim()) {
    return "Le numéro de téléphone est requis."
  }
  if (!PHONE_REGEX.test(data.phone.trim())) {
    return "Format de téléphone invalide (ex: +241 01 02 03 04 ou 074000000)."
  }
  if (data.email && data.email.trim() !== "" && !EMAIL_REGEX.test(data.email.trim())) {
    return "L'adresse email est invalide."
  }
  return null
}

export function ClientsPage() {
  const {
    clients,
    addClient,
    removeClient,
    updateClient,
    invoices,
    user,
    viewFormat,
    isDataLoaded,
  } = useStore(
    useShallow((state) => ({
      clients: state.clients,
      addClient: state.addClient,
      removeClient: state.removeClient,
      updateClient: state.updateClient,
      invoices: state.invoices,
      user: state.user,
      viewFormat: state.viewFormat,
      isDataLoaded: state.isDataLoaded,
    }))
  )

  const [searchQuery, setSearchQuery] = React.useState("")
  const debouncedSearch = useDebouncedValue(searchQuery, 200)
  useCommandFilter("clients", setSearchQuery)
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 9 // Grid 3x3

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingClient, setEditingClient] = React.useState<Client | null>(null)
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = React.useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false)
  const [successModalOpen, setSuccessModalOpen] = React.useState(false)
  const [clientToDeleteId, setClientToDeleteId] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [successModalData, setSuccessModalData] = React.useState<import("@/lib/store").Client | null>(null)

  const [newClient, setNewClient] = React.useState<ClientFormData>(INITIAL_CLIENT_FORM)
  const [editFormData, setEditFormData] = React.useState<ClientFormData>(INITIAL_CLIENT_FORM)

  const filteredClients = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return clients.filter(
      (client) =>
        !client.deletedAt &&
        (client.name.toLowerCase().includes(q) ||
        (client.email || "").toLowerCase().includes(q))
    )
  }, [clients, debouncedSearch])

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage) || 1
  const safePage = Math.min(currentPage, Math.max(1, totalPages))
  const paginatedClients = filteredClients.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  )

  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages])

  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client)
    setEditFormData({
      name: client.name || "",
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      nif: client.nif || "",
      rccm: client.rccm || "",
      status: client.status === "inactive" ? "inactive" : "active",
    })
    setIsEditDialogOpen(true)
  }

  const handleOpenDetails = (client: Client) => {
    setSelectedClient(client)
    setIsDetailsDialogOpen(true)
  }

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    const validationError = validateClientInput(newClient)
    if (validationError) {
      toast.error(validationError)
      return
    }

    const clientToCreate: import("@/lib/types/api").ClientCreateRequest = {
      name: newClient.name.trim(),
      email: newClient.email && newClient.email.trim() !== "" ? newClient.email.trim() : null,
      phone: newClient.phone.trim(),
      address: newClient.address?.trim() || null,
      nif: newClient.nif?.trim() || null,
      rccm: newClient.rccm?.trim() || null,
      status: (newClient.status as "active" | "inactive") || "active",
    }

    setIsSubmitting(true)
    try {
      const response = await createClient(clientToCreate)
      if (!response.success) {
        throw new Error(response.error)
      }

      addClient(response.data)
      setIsAddDialogOpen(false)
      setNewClient(INITIAL_CLIENT_FORM)
      setSuccessModalData(response.data)
      setSuccessModalOpen(true)
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(`Échec de l'ajout : ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClient || isSubmitting) return

    const validationError = validateClientInput(editFormData)
    if (validationError) {
      toast.error(validationError)
      return
    }

    const originalClient = clients.find((c) => c.id === editingClient.id)
    const clientToSave: Client = {
      ...editingClient,
      name: editFormData.name.trim(),
      email: editFormData.email && editFormData.email.trim() !== "" ? editFormData.email.trim() : null,
      phone: editFormData.phone?.trim() || null,
      address: editFormData.address?.trim() || null,
      nif: editFormData.nif?.trim() || null,
      rccm: editFormData.rccm?.trim() || null,
      status: editFormData.status || "active",
    }

    setIsSubmitting(true)
    try {
      const response = await updateClientAction(clientToSave.id, clientToSave)
      if (!response.success) {
        throw new Error(response.error)
      }

      updateClient(clientToSave.id, response.data)
      setIsEditDialogOpen(false)
      setEditingClient(null)
      toast.success("Client mis à jour avec succès")
    } catch (error) {
      if (originalClient) updateClient(clientToSave.id, originalClient)
      const msg = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(`Échec de la modification : ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (isSubmitting) return

    const clientToRestore = clients.find((c) => c.id === id)
    removeClient(id)
    toast.success("Client supprimé avec succès")
    setClientToDeleteId(null)

    setIsSubmitting(true)
    try {
      const response = await deleteClient(id)
      if (!response.success) {
        throw new Error(response.error)
      }
    } catch (error) {
      if (clientToRestore) addClient(clientToRestore)
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
            <p className="text-sm text-muted-foreground font-medium">Chargement des clients...</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="shrink-0 pb-4 border-b border-border bg-background z-10 space-y-4">
            <PageHeader
              title="Clients"
              description="Gérez votre base de clients et leurs coordonnées"
              actions={
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsExportModalOpen(true)}
                    className="gap-2 hidden sm:flex cursor-pointer"
                  >
                    <DownloadCloud className="w-4 h-4" /> Export Excel
                  </Button>
                  <Button
                    variant="primary-shadow"
                    className="gap-2 cursor-pointer"
                    onClick={() => {
                      setNewClient(INITIAL_CLIENT_FORM)
                      setIsAddDialogOpen(true)
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Nouveau client
                  </Button>
                </>
              }
            />

            <SearchBar
              placeholder="Rechercher un client..."
              value={searchQuery}
              onChange={setSearchQuery}
              viewFormatKey="clients"
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 pt-4 pr-1 space-y-4">
            <ClientViews
              clients={paginatedClients}
              viewFormat={viewFormat.clients || "table"}
              invoices={invoices}
              user={user}
              searchQuery={searchQuery}
              onViewDetails={handleOpenDetails}
              onEdit={handleOpenEdit}
              onDelete={(id) => setClientToDeleteId(id)}
              onOpenAdd={() => {
                setNewClient(INITIAL_CLIENT_FORM)
                setIsAddDialogOpen(true)
              }}
            />
          </div>

          <div className="shrink-0 pt-3 border-t border-border bg-background">
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>

          <ClientFormDialog
            mode="add"
            isOpen={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            data={newClient}
            onChange={setNewClient}
            onSubmit={handleAddClient}
            isSubmitting={isSubmitting}
          />

          <ClientFormDialog
            mode="edit"
            isOpen={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            data={editFormData}
            onChange={setEditFormData}
            onSubmit={handleEditClient}
            isSubmitting={isSubmitting}
          />

          <ClientDeleteDialog
            clientId={clientToDeleteId}
            onOpenChange={(open) => !open && setClientToDeleteId(null)}
            onConfirm={handleDelete}
            isSubmitting={isSubmitting}
          />

          <ClientDetailsDialog
            isOpen={isDetailsDialogOpen}
            onOpenChange={setIsDetailsDialogOpen}
            client={selectedClient}
            invoices={invoices}
            user={user}
            onEdit={(client) => {
              setIsDetailsDialogOpen(false)
              handleOpenEdit(client)
            }}
          />

          <CreationSuccessModal
            isOpen={successModalOpen}
            onOpenChange={setSuccessModalOpen}
            title="Client créé avec succès"
            subtitle={`La fiche de ${successModalData?.name || "ce client"} a été enregistrée avec succès.`}
            details={[
              { label: "Nom du client", value: successModalData?.name || "—" },
              { label: "Email", value: successModalData?.email || "—" },
              { label: "Téléphone", value: successModalData?.phone || "—" },
            ]}
            onClose={() => {
              setSuccessModalOpen(false)
              setSuccessModalData(null)
            }}
          />

          <DataExportModal
            open={isExportModalOpen}
            onOpenChange={setIsExportModalOpen}
            defaultScope="clients"
            initialEntity="clients"
          />
        </div>
      )}
    </>
  )
}
