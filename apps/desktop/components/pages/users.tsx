"use client"

import { getUsers, updateUser as updateUserService, deleteUser } from "@/app/actions/user.actions"
import * as React from "react"
import {
  UserPlus,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { PageHeader } from "@/components/features/common/PageHeader"
import { UserModals } from "./users/UserModals"
import { UserTableRow } from "./users/UserTableRow"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value"
import { Pagination } from "@workspace/ui/components/pagination-custom"
import { UserResponse } from "@/lib/types/api"

const checkIsActive = (u: UserResponse): boolean => {
  if (!u) return false
  if (u.deletedAt && u.deletedAt !== null) return false
  if (
    "isActive" in u &&
    (u as unknown as Record<string, unknown>).isActive !== undefined &&
    (u as unknown as Record<string, unknown>).isActive !== null
  ) {
    const isActive = (u as unknown as Record<string, unknown>).isActive
    return isActive === true || isActive === 1 || isActive === "1" || isActive === "ACTIF"
  }
  if (u.is_active !== undefined && u.is_active !== null) {
    return u.is_active === 1 || u.is_active === (true as unknown as number)
  }
  if (u.role === "admin") return true
  return false
}

interface UsersPageProps {
  onCreateUser: () => void
  onEditUser: (id: string) => void
}

export function UsersPage({ onCreateUser, onEditUser }: UsersPageProps) {
  const users = useStore((state) => state.users)
  const setUsers = useStore((state) => state.setUsers)
  const updateUser = useStore((state) => state.updateUser)
  const removeUser = useStore((state) => state.removeUser)
  const currentUser = useStore((state) => state.user)

  const [isLoading, setIsLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const debouncedSearch = useDebouncedValue(searchQuery, 200)
  const [roleFilter, setRoleFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 9 // Harmonisation Grille 3x3

  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = React.useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false)
  const [isResetModalOpen, setIsResetModalOpen] = React.useState(false)
  const [isPasswordDisplayOpen, setIsPasswordDisplayOpen] = React.useState(false)

  const [selectedUser, setSelectedUser] = React.useState<UserResponse | null>(null)
  const [tempPassword, setTempPassword] = React.useState("")
  const [deleteConfirmName, setDeleteConfirmName] = React.useState("")

  const fetchUsers = React.useCallback(
    async (signal: AbortSignal) => {
      try {
        const res = await getUsers()
        if (!res.success) {
          if (res.error === "Forbidden") {
            toast.error("Accès non autorisé ou session expirée pour les utilisateurs")
          } else {
            toast.error(res.error || "Erreur lors du chargement des utilisateurs")
          }
          return
        }
        if (res.data) setUsers(res.data)
      } catch (err) {
        if (signal.aborted) return
        console.error("[UsersPage] Fetch error:", err)
        toast.error(`Erreur chargement utilisateurs : ${err instanceof Error ? err.message : "Inconnue"}`)
      } finally {
        setIsLoading(false)
      }
    },
    [setUsers]
  )

  const fetchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  React.useEffect(() => {
    const controller = new AbortController()
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
    }

    fetchTimeoutRef.current = setTimeout(() => {
      if (currentUser?.role !== "admin") {
        setIsLoading(false)
      } else {
        fetchUsers(controller.signal)
      }
    }, 100)

    return () => {
      controller.abort()
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current)
    }
  }, [currentUser?.id, currentUser?.role, fetchUsers])

  const filteredUsers = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      const matchesRole = roleFilter === "all" || u.role === roleFilter
      const isActive = checkIsActive(u)
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? isActive : !isActive)
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, debouncedSearch, roleFilter, statusFilter])

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1
  const safePage = Math.min(currentPage, Math.max(1, totalPages))
  const paginatedUsers = filteredUsers.slice(
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
  }, [searchQuery, roleFilter, statusFilter])

  const generatePassword = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    let retVal = ""
    for (let i = 0, n = charset.length; i < 12; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n))
    }
    return retVal
  }

  const handleToggleStatus = async () => {
    if (!selectedUser || isSubmitting) return
    setIsSubmitting(true)
    try {
      const currentActive = checkIsActive(selectedUser)
      const newStatus = !currentActive
      const res = await updateUserService(selectedUser.id, {
        name: selectedUser.name,
        email: selectedUser.email,
        role: selectedUser.role,
        is_active: newStatus,
      })
      if (res.success) {
        toast.success(!newStatus ? "Compte désactivé" : "Compte réactivé")
        const updatedUsers = await getUsers()
        if (updatedUsers.success && updatedUsers.data) {
          const user = updatedUsers.data.find((u) => u.id === selectedUser.id)
          if (user) updateUser(selectedUser.id, user)
        }
        setIsStatusModalOpen(false)
      } else {
        toast.error(res.error || "Erreur")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur réseau")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser || isSubmitting) return
    if (deleteConfirmName !== selectedUser.name) {
      toast.error("Le nom saisi ne correspond pas")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await deleteUser(selectedUser.id)
      if (res.success) {
        toast.success("Utilisateur supprimé")
        removeUser(selectedUser.id)
        setIsDeleteModalOpen(false)
        setDeleteConfirmName("")
      } else {
        toast.error(res.error || "Erreur")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur réseau")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    if (!selectedUser || isSubmitting) return
    const pw = generatePassword()
    setIsSubmitting(true)
    try {
      const res = await updateUserService(selectedUser.id, { password: pw } as any)
      if (res.success) {
        setTempPassword(pw)
        setIsResetModalOpen(false)
        setIsPasswordDisplayOpen(true)
      } else {
        toast.error(res.error || "Erreur")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur réseau")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 pb-4 border-b border-border bg-background z-10 space-y-4">
        {currentUser?.role !== "admin" && (
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
          title="Gestion des Utilisateurs"
          description={`${users.filter((u) => checkIsActive(u)).length} actif(s) — ${users.filter((u) => !checkIsActive(u)).length} inactif(s)`}
          actions={
            <Button
              onClick={onCreateUser}
              disabled={currentUser?.role !== "admin"}
              variant="primary-shadow"
              className="gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Ajouter un utilisateur
            </Button>
          }
        />

        {/* Encart synthétique des prérogatives RBAC */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs space-y-0.5">
              <p className="font-bold text-foreground">Administrateur (Direction / Gérant)</p>
              <p className="text-muted-foreground leading-relaxed text-[11px]">
                Accès intégral : Gestion des utilisateurs, Journal d&apos;audit, Paramètres fiscaux/SMTP, Catalogue de services, Suppression de documents et d&apos;écritures comptables.
              </p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs space-y-0.5">
              <p className="font-bold text-foreground">Opérateur (Commercial / Caissier)</p>
              <p className="text-muted-foreground leading-relaxed text-[11px]">
                Opérations courantes : Création et suivi des Devis, Factures, Règlements, Avoirs, Clients et mouvements de Stock. Sans droit de suppression comptable ni accès à l&apos;Administration.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card border-border text-foreground"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="min-w-[165px] w-[170px] bg-card border-border">
              <SelectValue placeholder="Rôle" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">Tous les rôles</SelectItem>
              <SelectItem value="admin">Administrateur</SelectItem>
              <SelectItem value="user">Opérateur</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="min-w-[165px] w-[170px] bg-card border-border">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="inactive">Inactif</SelectItem>
            </SelectContent>
          </Select>
          {(searchQuery || roleFilter !== "all" || statusFilter !== "all") && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearchQuery("")
                setRoleFilter("all")
                setStatusFilter("all")
              }}
              className="text-muted-foreground h-9 cursor-pointer"
            >
              Réinitialiser
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pt-4 pr-1 space-y-4">
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground space-y-4 min-h-[300px]">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm font-medium">Chargement des utilisateurs...</p>
            </div>
          ) : (
            <div className="overflow-auto overflow-x-auto min-h-0">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="bg-secondary/30 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-4">Utilisateur</th>
                    <th className="px-6 py-4">Rôle</th>
                    <th className="px-6 py-4">Statut</th>
                    <th className="px-6 py-4">Création</th>
                    <th className="px-6 py-4">Dernière connexion</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {paginatedUsers.map((u) => (
                    <UserTableRow
                      key={u.id}
                      user={u}
                      currentUser={currentUser}
                      isActive={checkIsActive(u)}
                      onEditUser={onEditUser}
                      onOpenResetModal={(user) => {
                        setSelectedUser(user)
                        setIsResetModalOpen(true)
                      }}
                      onOpenStatusModal={(user) => {
                        setSelectedUser(user)
                        setIsStatusModalOpen(true)
                      }}
                      onOpenDeleteModal={(user) => {
                        setSelectedUser(user)
                        setIsDeleteModalOpen(true)
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 pt-3 border-t border-border bg-background">
        <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>

      <UserModals
        selectedUser={selectedUser}
        currentUser={currentUser}
        isSubmitting={isSubmitting}
        isStatusModalOpen={isStatusModalOpen}
        setIsStatusModalOpen={setIsStatusModalOpen}
        handleToggleStatus={handleToggleStatus}
        isDeleteModalOpen={isDeleteModalOpen}
        setIsDeleteModalOpen={setIsDeleteModalOpen}
        deleteConfirmName={deleteConfirmName}
        setDeleteConfirmName={setDeleteConfirmName}
        handleDeleteUser={handleDeleteUser}
        isResetModalOpen={isResetModalOpen}
        setIsResetModalOpen={setIsResetModalOpen}
        handleResetPassword={handleResetPassword}
        isPasswordDisplayOpen={isPasswordDisplayOpen}
        setIsPasswordDisplayOpen={setIsPasswordDisplayOpen}
        tempPassword={tempPassword}
        checkIsActive={checkIsActive}
      />
    </div>
  )
}
