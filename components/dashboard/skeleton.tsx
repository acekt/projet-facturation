"use client"

import * as React from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
            <div className="h-8 w-48 bg-muted rounded-md" />
            <div className="h-4 w-32 bg-muted rounded-md" />
        </div>
        <div className="flex gap-2">
            <div className="h-10 w-32 bg-muted rounded-md" />
            <div className="h-10 w-32 bg-muted rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
                <div className="h-3 w-20 bg-muted rounded" />
            </CardHeader>
            <CardContent>
                <div className="h-10 w-24 bg-muted rounded mb-2" />
                <div className="h-3 w-32 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 h-[350px] bg-card border-border shadow-sm" />
        <Card className="h-[350px] bg-card border-border shadow-sm" />
      </div>

      <Card className="h-48 bg-card border-border shadow-sm" />
    </div>
  )
}
