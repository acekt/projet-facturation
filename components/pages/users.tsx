"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Users, UserPlus, Shield, ShieldCheck, Mail, MoreVertical,
    Trash2, Key, Edit2, UserX, UserCheck, Search, Filter,
    AlertTriangle, Check, Copy, X, ShieldAlert
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Pagination } from "@/components/ui/pagination-custom"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function UsersPage() {
  const [users, setUsers] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10
  const { user: currentUser } = useStore()

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = React.useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false)
  const [isResetModalOpen, setIsResetModalOpen] = React.useState(false)
  const [isPasswordDisplayOpen, setIsPasswordDisplayOpen] = React.useState(false)

  const [selectedUser, setSelectedUser] = React.useState<any>(null)
  const [tempPassword, setTempPassword] = React.useState("")
  const [deleteConfirmName, setDeleteConfirmName] = React.useState("")

  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    role: "user",
    password: ""
  })

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (err) {
      toast.error("Erreur lors du chargement des utilisateurs")
    } finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    fetchUsers()
  }, [])

  const filteredUsers = React.useMemo(() => {
    return users.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              u.email.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesRole = roleFilter === "all" || u.role === roleFilter
        const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? u.is_active === 1 : u.is_active === 0)
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
    const pw = generatePassword()
    setFormData({ name: "", email: "", role: "user", password: pw })
    setTempPassword(pw)
    setIsAddModalOpen(true)
  }

  const handleAddUser = async () => {
    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
        if (res.ok) {
            toast.success("Utilisateur créé avec succès")
            setIsAddModalOpen(false)
            setIsPasswordDisplayOpen(true)
            fetchUsers()
        } else {
            const data = await res.json()
            toast.error(data.error || "Erreur lors de la création")
        }
    } catch (e) {
        toast.error("Erreur réseau")
    }
  }

  const handleUpdateUser = async () => {
    try {
        const res = await fetch(`/api/users/${selectedUser.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: formData.name, role: formData.role })
        })
        if (res.ok) {
            toast.success("Utilisateur mis à jour")
            setIsEditModalOpen(false)
            fetchUsers()
        }
    } catch (e) {
        toast.error("Erreur réseau")
    }
  }

  const handleToggleStatus = async () => {
    try {
        const res = await fetch(`/api/users/${selectedUser.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: selectedUser.is_active === 1 ? 0 : 1 })
        })
        if (res.ok) {
            toast.success(selectedUser.is_active === 1 ? "Compte désactivé" : "Compte réactivé")
            setIsStatusModalOpen(false)
            fetchUsers()
        } else {
            const data = await res.json()
            toast.error(data.error)
        }
    } catch (e) {
        toast.error("Erreur réseau")
    }
  }

  const handleDeleteUser = async () => {
    if (deleteConfirmName !== selectedUser.name) {
        toast.error("Le nom saisi ne correspond pas")
        return
    }
    try {
        const res = await fetch(`/api/users/${selectedUser.id}`, { method: 'DELETE' })
        if (res.ok) {
            toast.success("Utilisateur supprimé")
            setIsDeleteModalOpen(false)
            setDeleteConfirmName("")
            fetchUsers()
        }
    } catch (e) {
        toast.error("Erreur réseau")
    }
  }

  const handleResetPassword = async () => {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground mt-1">
            {users.filter(u => u.is_active === 1).length} actifs — {users.filter(u => u.is_active === 0).length} inactifs
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="gap-2 bg-primary shadow-lg shadow-primary/20">
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

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
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
                {paginatedUsers.length > 0 ? (
                  paginatedUsers.map((u) => (
                      <tr key={u.id} className={cn(
                          "group transition-colors",
                          u.id === currentUser?.id ? "bg-indigo-500/5" : "hover:bg-muted/30"
                      )}>
                          <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                  <Avatar className="h-7 w-7 ring-1 ring-border">
                                      <AvatarFallback className="bg-primary/10 text-primary font-black text-[10px]">
                                          {u.name.substring(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                  </Avatar>
                                  <div>
                                      <p className="text-[11px] font-black text-foreground uppercase tracking-tighter">
                                          {u.name} {u.id === currentUser?.id && <span className="text-[9px] text-primary font-bold">(MOI)</span>}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground leading-none">{u.email}</p>
                                  </div>
                              </div>
                          </td>
                          <td className="px-4 py-2">
                              <Badge className={cn(
                                  "text-[9px] px-1.5 py-0 h-5 font-black uppercase tracking-widest",
                                  u.role === 'admin' ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                              )}>
                                  {u.role === 'admin' ? 'Admin' : 'User'}
                              </Badge>
                          </td>
                          <td className="px-4 py-2">
                              {u.is_active === 1 ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] px-1.5 py-0 h-5 font-black uppercase tracking-widest">
                                      Actif
                                  </Badge>
                              ) : (
                                  <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20 text-[9px] px-1.5 py-0 h-5 font-black uppercase tracking-widest">
                                      Off
                                  </Badge>
                              )}
                          </td>
                          <td className="px-4 py-2 text-[10px] text-muted-foreground font-black uppercase tracking-tighter">
                              {u.created_at?.split(' ')[0]}
                          </td>
                          <td className="px-4 py-2 text-[10px] text-muted-foreground font-bold italic">
                              {u.last_login_at || "N/A"}
                          </td>
                          <td className="px-6 py-4 text-right">
                              <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                          <MoreVertical className="w-4 h-4" />
                                      </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-card border-border w-48">
                                      <DropdownMenuItem onClick={() => { setSelectedUser(u); setFormData({ name: u.name, role: u.role, email: u.email, password: "" }); setIsEditModalOpen(true); }} className="gap-2">
                                          <Edit2 className="w-4 h-4" /> Modifier
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => { setSelectedUser(u); setIsResetModalOpen(true); }} className="gap-2">
                                          <Key className="w-4 h-4" /> Reset MDP
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => { setSelectedUser(u); setIsStatusModalOpen(true); }} className={cn("gap-2", u.is_active === 1 ? "text-amber-500" : "text-emerald-500")}>
                                          {u.is_active === 1 ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                          {u.is_active === 1 ? "Désactiver" : "Activer"}
                                      </DropdownMenuItem>
                                      {u.id !== currentUser?.id && (
                                          <DropdownMenuItem onClick={() => { setSelectedUser(u); setIsDeleteModalOpen(true); }} className="gap-2 text-destructive focus:text-destructive">
                                              <Trash2 className="w-4 h-4" /> Supprimer
                                          </DropdownMenuItem>
                                      )}
                                  </DropdownMenuContent>
                              </DropdownMenu>
                          </td>
                      </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <Empty className="py-20 border-0 rounded-none bg-transparent">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Users className="w-6 h-6 text-muted-foreground" />
                          </EmptyMedia>
                          <EmptyTitle>AUCUN UTILISATEUR</EmptyTitle>
                          <EmptyDescription className="font-black uppercase tracking-widest text-[10px]">
                            {searchQuery ? "AUCUNE CORRESPONDANCE TROUVÉE." : "AJOUTEZ DES COMPTES POUR VOS COLLABORATEURS."}
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </td>
                  </tr>
                )}
            </tbody>
        </table>
        <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
        />
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
                <Input id="add-email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="jean@letoile.ga" className="bg-secondary" />
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
            <Button onClick={handleAddUser} disabled={!formData.name || !formData.email}>Créer l'utilisateur</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Edit User */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <VisuallyHidden>
              <DialogDescription>Modifiez le nom ou le rôle de cet utilisateur.</DialogDescription>
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
            <Button onClick={handleUpdateUser}>Enregistrer les modifications</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Status Change */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{selectedUser?.is_active === 1 ? "Désactiver" : "Réactiver"} le compte</DialogTitle>
            <DialogDescription>
                {selectedUser?.is_active === 1
                    ? `Voulez-vous désactiver le compte de ${selectedUser?.name} ? Il ne pourra plus se connecter à l'application.`
                    : `Voulez-vous réactiver le compte de ${selectedUser?.name} ?`
                }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsStatusModalOpen(false)}>Annuler</Button>
            <Button
                variant={selectedUser?.is_active === 1 ? "destructive" : "default"}
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
