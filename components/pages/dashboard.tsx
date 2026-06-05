"use client"

import * as React from "react"
import { useStore } from "@/lib/store"
import { DashboardAdmin } from "@/components/dashboard/admin"
import { DashboardUser } from "@/components/dashboard/user"
import { DashboardSkeleton } from "@/components/dashboard/skeleton"

interface DashboardProps {
  onNavigate: (page: string) => void
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { user } = useStore()

  console.log('[Dashboard] User state:', user)

  if (!user) {
    console.log('[Dashboard] No user, showing skeleton')
    return <DashboardSkeleton />
  }

  console.log('[Dashboard] User role:', user.role)

  if (user.role === 'admin') {
    return <DashboardAdmin onNavigate={onNavigate} />
  }

  return <DashboardUser onNavigate={onNavigate} />
}
