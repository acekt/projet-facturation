"use client"

import { getUsers, updateUser as updateUserService, deleteUser } from "@/app/actions/user.actions"
import * as React from "react"
import {
  UserPlus,
  Search,
  ShieldAlert,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { UserModals } from "./users/UserModals"
import { UserTableRow } from "./users/UserTableRow"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Pagination } from "@workspace/ui/components/pagination-custom"
import { StatusBadge } from "@workspace/ui/components/status-badge"
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

  React.useEffect(() => {
    const controller = new AbortController()
    if (currentUser?.role !== "admin") {
      setIsLoading(false)
    } else {
      fetchUsers(controller.signal)
    }
    return () => {
      controller.abort()
    }
  }, [currentUser?.id, currentUser?.role, fetchUsers])

  const filteredUsers = React.useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesRole = roleFilter === "all" || u.role === roleFilter
      const isActive = checkIsActive(u)
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? isActive : !isActive)
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, searchQuery, roleFilter, statusFilter])

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

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
      const res = await updateUserService(selectedUser.id, { password: pw })
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
    <div className="flex-1 flex flex-col overflow-hidden space-y-6">
      {currentUser?.role !== "admin" && (
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground mt-1 tabular-nums">
            {users.filter((u) => checkIsActive(u)).length} actifs — {users.filter((u) => !checkIsActive(u)).length} inactifs
          </p>
        </div>
        <Button
          onClick={onCreateUser}
          disabled={currentUser?.role !== "admin"}
          variant="primary-shadow"
          className="gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Ajouter un utilisateur
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border text-foreground"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px] bg-secondary/50 border-border">
            <SelectValue placeholder="Rôle" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Tous les rôles</SelectItem>
            <SelectItem value="admin">Administrateur</SelectItem>
            <SelectItem value="user">Opérateur</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] bg-secondary/50 border-border">
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
            className="text-muted-foreground h-9"
          >
            Réinitialiser
          </Button>
        )}
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card rounded-xl border border-border shadow-sm">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-muted-foreground space-y-4 min-h-[300px]">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-medium">Chargement des utilisateurs...</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto overflow-x-auto min-h-0">
              <table className="w-full text-left border-collapse min-w-[700px]">
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
            <div className="pt-4 p-4 border-t border-border/50">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>
          </>
        )}
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
