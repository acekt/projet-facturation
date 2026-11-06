"use client"

import * as React from "react"
import {
  MoreVertical,
  Trash2,
  Key,
  Edit2,
  UserX,
  UserCheck,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { cn } from "@/lib/utils"
import { UserResponse } from "@/lib/types/api"

interface UserTableRowProps {
  user: UserResponse
  currentUser: { id?: string; role?: string } | null
  isActive: boolean
  onEditUser: (id: string) => void
  onOpenResetModal: (u: UserResponse) => void
  onOpenStatusModal: (u: UserResponse) => void
  onOpenDeleteModal: (u: UserResponse) => void
}

function formatCreatedDateFr(val?: string | null): string {
  if (!val) return "—"
  const raw = val.trim()
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`
  }
  const d = new Date(raw)
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, "0")
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }
  return raw.split(" ")[0] || "—"
}

function formatLastLoginFr(val?: string | null): string {
  if (!val || val === "N/A") return "Jamais connecté"
  const raw = val.trim()
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T") + (raw.endsWith("Z") ? "" : "Z")
  const d = new Date(normalized)
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, "0")
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, "0")
    const mins = String(d.getMinutes()).padStart(2, "0")
    return `${day}/${month}/${year} à ${hours}:${mins}`
  }
  return raw
}

export function UserTableRow({
  user,
  currentUser,
  isActive,
  onEditUser,
  onOpenResetModal,
  onOpenStatusModal,
  onOpenDeleteModal,
}: UserTableRowProps) {
  const isInactive = !isActive

  return (
    <tr
      className={cn(
        "group transition-colors",
        user.id === currentUser?.id ? "bg-indigo-500/5" : "hover:bg-muted/30",
        isInactive ? "opacity-60 grayscale" : ""
      )}
    >
      <td className="px-6 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8 ring-1 ring-border">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
              {user.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-tight">
              {user.name}{" "}
              {user.id === currentUser?.id && (
                <span className="text-[10px] text-primary font-bold">(MOI)</span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground leading-none mt-0.5">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-3">
        <Badge
          className={cn(
            "text-[11px] px-2.5 py-0.5 h-6 font-semibold inline-flex items-center gap-1.5 border",
            user.role === "admin"
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25"
              : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/25"
          )}
        >
          {user.role === "admin" ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5" />
              Administrateur
            </>
          ) : (
            <>
              <UserCheck className="w-3.5 h-3.5" />
              Opérateur
            </>
          )}
        </Badge>
      </td>
      <td className="px-6 py-3">
        <StatusBadge
          variant={isActive ? "active" : "inactive"}
          label={isActive ? "ACTIF" : "INACTIF"}
        />
      </td>
      <td className="px-6 py-3 text-xs text-muted-foreground font-medium tabular-nums whitespace-nowrap">
        {formatCreatedDateFr(user.created_at)}
      </td>
      <td className="px-6 py-3 text-xs text-muted-foreground font-medium tabular-nums whitespace-nowrap">
        {formatLastLoginFr(user.last_login_at)}
      </td>
      <td className="px-6 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={currentUser?.role !== "admin"}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border w-48">
            {!isInactive && (
              <DropdownMenuItem onClick={() => onEditUser(user.id)} className="gap-2">
                <Edit2 className="w-4 h-4" /> Modifier
              </DropdownMenuItem>
            )}
            {!isInactive && (
              <DropdownMenuItem onClick={() => onOpenResetModal(user)} className="gap-2">
                <Key className="w-4 h-4" /> Réinitialiser MDP
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onOpenStatusModal(user)}
              className={cn("gap-2", !isInactive ? "text-amber-500" : "text-emerald-500")}
            >
              {!isInactive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
              {!isInactive ? "Désactiver" : "Réactiver"}
            </DropdownMenuItem>
            {user.id !== currentUser?.id && !isInactive && (
              <DropdownMenuItem
                onClick={() => onOpenDeleteModal(user)}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4" /> Supprimer
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}
