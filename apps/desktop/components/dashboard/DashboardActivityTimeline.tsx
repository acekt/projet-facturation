"use client"

import * as React from "react"
import { ScrollText, ArrowUpRight, Inbox } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"

interface TimelineItem {
  id: string
  action: string
  client: string
  time: string
}

interface DashboardActivityTimelineProps {
  activityTimeline: TimelineItem[]
  onNavigate: (page: string) => void
}

export function DashboardActivityTimeline({
  activityTimeline,
  onNavigate,
}: DashboardActivityTimelineProps) {
  return (
    <Card className="border-border overflow-hidden">
      <CardHeader className="bg-secondary/30">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Journal d&apos;Audit Récent</CardTitle>
            <CardDescription>Dernières actions administratives et métier</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-indigo-500 font-bold text-xs uppercase tracking-tighter"
            onClick={() => onNavigate("audit")}
          >
            Voir tout <ArrowUpRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/50">
          {(activityTimeline || []).slice(0, 5).map((log) => (
            <div key={log.id} className="flex items-center justify-between p-4 hover:bg-secondary/20 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                  <ScrollText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{log.action}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{log.client}</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{log.time}</span>
            </div>
          ))}
          {(!activityTimeline || activityTimeline.length === 0) && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <Inbox className="w-10 h-10 text-muted-foreground opacity-20" />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Journal vide — aucune action enregistrée
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

