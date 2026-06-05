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

  if (!user) {
    return <DashboardSkeleton />
  }

  if (user.role === 'admin') {
    return <DashboardAdmin onNavigate={onNavigate} />
  }

  return <DashboardUser onNavigate={onNavigate} />
}
