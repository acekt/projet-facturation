"use client"

import * as React from "react"
import {
    UserPlus, MoreVertical,
    Trash2, Key, Edit2, UserX, UserCheck, Search,
    AlertTriangle, Copy, ShieldAlert
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Pagination } from "@/components/ui/pagination-custom"
import { StatusBadge } from "@/components/ui/status-badge"
import { UserResponse } from "@/lib/types/api"

const checkIsActive = (u: UserResponse): boolean => {
  if (!u) return false;
  if (u.deletedAt && u.deletedAt !== null) return false;
  if ('isActive' in u && (u as unknown as Record<string, unknown>).isActive !== undefined && (u as unknown as Record<string, unknown>).isActive !== null) {
    const isActive = (u as unknown as Record<string, unknown>).isActive;
    return isActive === true || isActive === 1 || isActive === "1" || isActive === "ACTIF";
  }
  if (u.is_active !== undefined && u.is_active !== null) {
    return u.is_active === 1 || u.is_active === true as unknown as number;
  }
  if (u.role === 'admin') return true;
  return false;
};

interface UsersPageProps {
  onCreateUser: () => void
  onEditUser: (id: string) => void
}
export function UsersPage({ onCreateUser, onEditUser }: UsersPageProps) {
  const users = useStore(state => state.users)
  const setUsers = useStore(state => state.setUsers)
  const updateUser = useStore(state => state.updateUser)
  const removeUser = useStore(state => state.removeUser)
  const [isLoading, setIsLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10
  const currentUser = useStore(state => state.user)

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = React.useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false)
  const [isResetModalOpen, setIsResetModalOpen] = React.useState(false)
  const [isPasswordDisplayOpen, setIsPasswordDisplayOpen] = React.useState(false)

  const [selectedUser, setSelectedUser] = React.useState<UserResponse | null>(null)
  const [tempPassword, setTempPassword] = React.useState("")
  const [deleteConfirmName, setDeleteConfirmName] = React.useState("")

  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    role: "user",
    password: ""
  })

  const fetchUsers = async (signal: AbortSignal) => {
    try {
      const res = await fetch('/api/users', { signal })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.warn('[UsersPage] API response not ok:', res.status, errorData)
        if (res.status === 401 || res.status === 403) {
          toast.error("Accès non autorisé ou session expirée pour les utilisateurs")
        } else {
          toast.error(errorData.error || `Erreur lors du chargement des utilisateurs (${res.status})`)
        }
        return
      }

      const data = await res.json()
      setUsers(data)
    } catch (err) {
      // AbortError is expected on component unmount — do not display an error toast
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('[UsersPage] Fetch error:', err)
      toast.error(`Erreur chargement utilisateurs : ${err instanceof Error ? err.message : 'Inconnue'}`)
    } finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    const controller = new AbortController()

    if (currentUser?.role !== 'admin') {
      setIsLoading(false)
    } else {
      fetchUsers(controller.signal)
    }

    return () => {
      controller.abort()
    }
  }, [currentUser?.id, currentUser?.role])

  const filteredUsers = React.useMemo(() => {
    return users.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
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

  const handleOpenAdd = () => {
    onCreateUser()
  }

  const handleAddUser = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...formData, username: formData.email })
        })
        const data = await res.json()
        if (res.ok) {
            toast.success("Utilisateur créé avec succès")
            // Use the JSON response to update UI instead of refetching
            setUsers([...users, data.user || data])
            setIsAddModalOpen(false)
            setIsPasswordDisplayOpen(true)
        } else {
            toast.error(data.error || "Erreur lors de la création")
        }
    } catch (e) {
        toast.error("Erreur réseau")
    } finally {
        setIsSubmitting(false)
    }
  }

  const handleUpdateUser = async () => {
    if (!selectedUser || isSubmitting) return;
    setIsSubmitting(true);
    try {
        const res = await fetch(`/api/users/${selectedUser.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: formData.name,
              email: formData.email || selectedUser.email,
              role: formData.role,
              is_active: checkIsActive(selectedUser)
            })
        })
        if (res.ok) {
            const data = await res.json()
            toast.success("Utilisateur mis à jour")
            updateUser(selectedUser.id, data.user || data)
            setIsEditModalOpen(false)
        } else {
            const errData = await res.json()
            toast.error(errData.error || "Erreur")
        }
    } catch (e) {
        toast.error("Erreur réseau")
    } finally {
        setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!selectedUser) return;
    try {
        const currentActive = checkIsActive(selectedUser);
        const newStatus = !currentActive; // Invert status as boolean
        const res = await fetch(`/api/users/${selectedUser.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: selectedUser.name,
              email: selectedUser.email,
              role: selectedUser.role,
              is_active: newStatus
            })
        })
        if (res.ok) {
            const data = await res.json()
            toast.success(!newStatus ? "Compte désactivé" : "Compte réactivé")
            updateUser(selectedUser.id, data.user || data)
            setIsStatusModalOpen(false)
        } else {
            const data = await res.json()
            toast.error(data.error)
        }
    } catch (e) {
        toast.error("Erreur réseau")
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (deleteConfirmName !== selectedUser.name) {
        toast.error("Le nom saisi ne correspond pas")
        return
    }
    try {
        const res = await fetch(`/api/users/${selectedUser.id}`, { method: 'DELETE' })
        if (res.ok) {
            toast.success("Utilisateur supprimé")
            removeUser(selectedUser.id)
            setIsDeleteModalOpen(false)
            setDeleteConfirmName("")
        } else {
            const data = await res.json()
            toast.error(data.error || "Erreur")
        }
    } catch (e) {
        toast.error("Erreur réseau")
    }
  }

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    const pw = generatePassword()
    try {
        const res = await fetch(`/api/users/${selectedUser.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        })
        if (res.ok) {
            setTempPassword(pw)
            setIsResetModalOpen(false)
            setIsPasswordDisplayOpen(true)
        }
    } catch (e) {
        toast.error("Erreur réseau")
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden space-y-6">
      {currentUser?.role !== 'admin' && (
        <Alert variant="default" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50 mb-6">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="font-medium">
            Vous êtes en mode lecture seule (Opérateur). Seul un Administrateur peut modifier ces paramètres.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground mt-1">
            {users.filter(u => checkIsActive(u)).length} actifs — {users.filter(u => !checkIsActive(u)).length} inactifs
          </p>
        </div>
        <Button onClick={handleOpenAdd} disabled={currentUser?.role !== 'admin'} className="gap-2 bg-primary shadow-lg shadow-primary/20">
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
            <Button variant="ghost" onClick={() => { setSearchQuery(""); setRoleFilter("all"); setStatusFilter("all"); }} className="text-muted-foreground h-9">
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
                    {paginatedUsers.map((u) => {
                        const isActive = checkIsActive(u);
                        const isInactive = !isActive;
                        return (
                        <tr key={u.id} className={cn(
                            "group transition-colors",
                            u.id === currentUser?.id ? "bg-indigo-500/5" : "hover:bg-muted/30",
                            isInactive ? "opacity-60 grayscale" : ""
                        )}>
                            <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-7 w-7 ring-1 ring-border">
                                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-[10px]">
                                            {u.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-[11px] font-semibold text-foreground uppercase tracking-tighter">
                                            {u.name} {u.id === currentUser?.id && <span className="text-[9px] text-primary font-bold">(MOI)</span>}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground leading-none">{u.email}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-2">
                                <Badge className={cn(
                                    "text-[9px] px-1.5 py-0 h-5 font-semibold uppercase tracking-widest",
                                    u.role === 'admin' ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                                )}>
                                    {u.role === 'admin' ? 'Admin' : 'User'}
                                </Badge>
                            </td>
                            <td className="px-4 py-2">
                                <StatusBadge 
                                    variant={isActive ? "active" : "inactive"} 
                                    label={isActive ? "ACTIF" : "INACTIF"} 
                                />
                            </td>
                            <td className="px-4 py-2 text-[10px] text-muted-foreground font-semibold uppercase tracking-tighter">
                                {u.created_at?.split(' ')[0]}
                            </td>
                            <td className="px-4 py-2 text-[10px] text-muted-foreground font-bold italic">
                                {u.last_login_at || "N/A"}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button disabled={currentUser?.role !== 'admin'} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-card border-border w-48">
                                        {!isInactive && (
                                            <DropdownMenuItem onClick={() => onEditUser(u.id)} className="gap-2">
                                                <Edit2 className="w-4 h-4" /> Modifier
                                            </DropdownMenuItem>
                                        )}
                                        {!isInactive && (
                                            <DropdownMenuItem onClick={() => { setSelectedUser(u); setIsResetModalOpen(true); }} className="gap-2">
                                                <Key className="w-4 h-4" /> Reset MDP
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => { setSelectedUser(u); setIsStatusModalOpen(true); }} className={cn("gap-2", !isInactive ? "text-amber-500" : "text-emerald-500")}>
                                            {!isInactive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                            {!isInactive ? "Désactiver" : "Réactiver"}
                                        </DropdownMenuItem>
                                        {u.id !== currentUser?.id && !isInactive && (
                                            <DropdownMenuItem onClick={() => { setSelectedUser(u); setIsDeleteModalOpen(true); }} className="gap-2 text-destructive focus:text-destructive">
                                                <Trash2 className="w-4 h-4" /> Supprimer
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </td>
                        </tr>
                    )})}
                </tbody>
              </table>
            </div>
            <div className="pt-4 p-4 border-t border-border/50">
              <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
              />
            </div>
          </>
        )}
      </div>

      {/* MODALS */}

      {/* 1. Add User */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Ajouter un utilisateur</DialogTitle>
            <DialogDescription>Créez un nouvel accès pour un membre de votre équipe.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="add-name">Nom complet</Label>
                <Input id="add-name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Jean Dupont" className="bg-secondary" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="add-email">Email</Label>
                <Input id="add-email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="jean@facturier.ga" className="bg-secondary" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="add-role">Rôle</Label>
                <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                        <SelectItem value="user">Opérateur</SelectItem>
                        <SelectItem value="admin">Administrateur</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Annuler</Button>
            <Button onClick={handleAddUser} disabled={!formData.name || !formData.email || isSubmitting}>
              {isSubmitting ? "Création..." : "Créer l'utilisateur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Edit User */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <VisuallyHidden>
              <DialogDescription>Formulaire de modification des informations de l'utilisateur</DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label>Email (Non modifiable)</Label>
                <Input value={formData.email} disabled className="bg-muted opacity-50" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="edit-name">Nom complet</Label>
                <Input id="edit-name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-secondary" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="edit-role">Rôle</Label>
                <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                        <SelectItem value="user">Opérateur</SelectItem>
                        <SelectItem value="admin">Administrateur</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Annuler</Button>
            <Button onClick={handleUpdateUser} disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Status Change */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{selectedUser && checkIsActive(selectedUser) ? "Désactiver" : "Réactiver"} le compte</DialogTitle>
            <DialogDescription>
                {selectedUser && checkIsActive(selectedUser)
                    ? `Voulez-vous désactiver le compte de ${selectedUser?.name} ? Il ne pourra plus se connecter à l'application.`
                    : `Voulez-vous réactiver le compte de ${selectedUser?.name} ?`
                }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsStatusModalOpen(false)}>Annuler</Button>
            <Button
                variant={selectedUser && checkIsActive(selectedUser) ? "destructive" : "default"}
                onClick={handleToggleStatus}
                disabled={selectedUser?.id === currentUser?.id}
            >
                Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Delete User */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="bg-card border-border border-destructive/20">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
                <AlertTriangle className="w-5 h-5" />
                <DialogTitle>Suppression définitive</DialogTitle>
            </div>
            <DialogDescription>
                Cette action est irréversible. Pour confirmer, veuillez saisir le nom complet de l'utilisateur : <strong>{selectedUser?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
                value={deleteConfirmName}
                onChange={e => setDeleteConfirmName(e.target.value)}
                placeholder="Saisir le nom exact..."
                className="bg-secondary"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deleteConfirmName !== selectedUser?.name}>
                Supprimer l'utilisateur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Password Display (Post creation or reset) */}
      <Dialog open={isPasswordDisplayOpen} onOpenChange={setIsPasswordDisplayOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                Mot de passe temporaire
            </DialogTitle>
            <DialogDescription>
                Veuillez copier et transmettre ce mot de passe à l'utilisateur. Il ne sera plus affiché après la fermeture de cette fenêtre.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-4 bg-secondary rounded-xl font-mono text-xl justify-center relative">
                {tempPassword}
                <Button variant="ghost" size="icon" className="absolute right-2" onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success("Copié !"); }}>
                    <Copy className="w-4 h-4" />
                </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPasswordDisplayOpen(false)}>J'ai bien noté le mot de passe</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Reset Request */}
      <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
                Un nouveau mot de passe temporaire sera généré pour <strong>{selectedUser?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsResetModalOpen(false)}>Annuler</Button>
            <Button onClick={handleResetPassword}>Générer le mot de passe</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
