"use client"

import * as React from "react"
import { useStore } from "@/lib/store"
import { DashboardAdmin } from "@/components/dashboard/admin"
import { DashboardUser } from "@/components/dashboard/user"
import { DashboardSkeleton } from "@/components/dashboard/skeleton"

interface DashboardProps {
  onNavigate: (page: string) => void
  user?: any
}

export function Dashboard({ onNavigate, user: propUser }: DashboardProps) {
  const storeUser = useStore(state => state.user)
  const user = propUser || storeUser
  const isDataLoaded = useStore(state => state.isDataLoaded)

  if (!isDataLoaded || !user) {
    return <DashboardSkeleton />
  }

  if (user.role === 'admin') {
    return <DashboardAdmin onNavigate={onNavigate} />
  }

  return <DashboardUser onNavigate={onNavigate} />
}
