"use client"

import * as React from "react"
import { AlertTriangle, Copy, ShieldAlert } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { toast } from "sonner"
import { UserResponse } from "@/lib/types/api"

interface UserModalsProps {
  selectedUser: UserResponse | null
  currentUser: { id?: string; role?: string } | null
  isSubmitting: boolean
  isStatusModalOpen: boolean
  setIsStatusModalOpen: (open: boolean) => void
  handleToggleStatus: () => void
  isDeleteModalOpen: boolean
  setIsDeleteModalOpen: (open: boolean) => void
  deleteConfirmName: string
  setDeleteConfirmName: (name: string) => void
  handleDeleteUser: () => void
  isResetModalOpen: boolean
  setIsResetModalOpen: (open: boolean) => void
  handleResetPassword: () => void
  isPasswordDisplayOpen: boolean
  setIsPasswordDisplayOpen: (open: boolean) => void
  tempPassword: string
  checkIsActive: (u: UserResponse) => boolean
}

export function UserModals({
  selectedUser,
  currentUser,
  isSubmitting,
  isStatusModalOpen,
  setIsStatusModalOpen,
  handleToggleStatus,
  isDeleteModalOpen,
  setIsDeleteModalOpen,
  deleteConfirmName,
  setDeleteConfirmName,
  handleDeleteUser,
  isResetModalOpen,
  setIsResetModalOpen,
  handleResetPassword,
  isPasswordDisplayOpen,
  setIsPasswordDisplayOpen,
  tempPassword,
  checkIsActive,
}: UserModalsProps) {
  return (
    <>
      {/* Status Change */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="bg-card border-border" side="right">
          <DialogHeader>
            <DialogTitle>
              {selectedUser && checkIsActive(selectedUser) ? "Désactiver" : "Réactiver"} le compte
            </DialogTitle>
            <DialogDescription>
              {selectedUser && checkIsActive(selectedUser)
                ? `Voulez-vous désactiver le compte de ${selectedUser?.name} ? Il ne pourra plus se connecter à l'application.`
                : `Voulez-vous réactiver le compte de ${selectedUser?.name} ?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsStatusModalOpen(false)}>
              Annuler
            </Button>
            <Button
              variant={selectedUser && checkIsActive(selectedUser) ? "destructive" : "default"}
              onClick={handleToggleStatus}
              disabled={selectedUser?.id === currentUser?.id || isSubmitting}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="bg-card border-border border-destructive/20">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertTriangle className="w-5 h-5" />
              <DialogTitle>Suppression définitive</DialogTitle>
            </div>
            <DialogDescription>
              Cette action est irréversible. Pour confirmer, veuillez saisir le nom complet de l&apos;utilisateur :{" "}
              <strong>{selectedUser?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Saisir le nom exact..."
              className="bg-secondary"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleteConfirmName !== selectedUser?.name || isSubmitting}
            >
              Supprimer l&apos;utilisateur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Display (Post reset) */}
      <Dialog open={isPasswordDisplayOpen} onOpenChange={setIsPasswordDisplayOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Mot de passe temporaire
            </DialogTitle>
            <DialogDescription>
              Veuillez copier et transmettre ce mot de passe à l&apos;utilisateur. Il ne sera plus affiché après la
              fermeture de cette fenêtre.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-4 bg-secondary rounded-xl font-mono text-xl justify-center relative">
            {tempPassword}
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2"
              onClick={() => {
                navigator.clipboard.writeText(tempPassword)
                toast.success("Copié !")
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPasswordDisplayOpen(false)}>J&apos;ai bien noté le mot de passe</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Request */}
      <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              Un nouveau mot de passe temporaire sera généré pour <strong>{selectedUser?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsResetModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleResetPassword} disabled={isSubmitting}>
              Générer le mot de passe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

