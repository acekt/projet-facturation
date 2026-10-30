"use client"

import * as React from "react"
import {
  MoreVertical,
  Trash2,
  Key,
  Edit2,
  UserX,
  UserCheck,
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
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7 ring-1 ring-border">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-[10px]">
              {user.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-tighter">
              {user.name}{" "}
              {user.id === currentUser?.id && (
                <span className="text-[9px] text-primary font-bold">(MOI)</span>
              )}
            </p>
            <p className="text-[10px] text-muted-foreground leading-none">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-2">
        <Badge
          className={cn(
            "text-[9px] px-1.5 py-0 h-5 font-semibold uppercase tracking-widest",
            user.role === "admin"
              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
              : "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
          )}
        >
          {user.role === "admin" ? "Admin" : "User"}
        </Badge>
      </td>
      <td className="px-4 py-2">
        <StatusBadge
          variant={isActive ? "active" : "inactive"}
          label={isActive ? "ACTIF" : "INACTIF"}
        />
      </td>
      <td className="px-4 py-2 text-[10px] text-muted-foreground font-semibold uppercase tracking-tighter tabular-nums">
        {user.created_at?.split(" ")[0]}
      </td>
      <td className="px-4 py-2 text-[10px] text-muted-foreground font-bold italic tabular-nums">
        {user.last_login_at || "N/A"}
      </td>
      <td className="px-6 py-4 text-right">
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
                <Key className="w-4 h-4" /> Reset MDP
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

