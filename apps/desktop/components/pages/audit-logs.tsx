"use client"

import { getAuditLogs } from "@/app/actions/audit.actions"
import * as React from "react"
import { ShieldCheck, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Badge } from "@workspace/ui/components/badge"
import { PageHeader } from "@workspace/ui/components/page-header"
import { SearchBar } from "@workspace/ui/components/search-bar"
import { Pagination } from "@workspace/ui/components/pagination-custom"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"

export interface AuditLogItem {
  id: string
  userId?: string
  userName?: string
  action: string
  entityType: string
  entityId?: string
  details?: string
  createdAt: string
  tenant_id?: string
}

export function AuditLogsPage() {
  const [logs, setLogs] = React.useState<AuditLogItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10

  React.useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await getAuditLogs()

        if (!res.success) {
          if (res.error === 'Unauthorized') {
            toast.error("Accès non autorisé ou session expirée pour le journal d'audit")
          } else {
            toast.error(res.error || "Erreur lors du chargement des logs")
          }
          return
        }

        if (res.data && Array.isArray(res.data)) {
          setLogs(res.data as AuditLogItem[])
        }
      } catch (err) {
        console.error('[AuditLogsPage] Fetch error:', err)
        toast.error("Impossible de récupérer les logs d'audit")
      } finally {
        setIsLoading(false)
      }
    }

    fetchLogs()
  }, [])

  const filteredLogs = React.useMemo(() => {
    if (!searchQuery.trim()) return logs
    const q = searchQuery.toLowerCase()
    return logs.filter((log) =>
      (log.userName && log.userName.toLowerCase().includes(q)) ||
      (log.action && log.action.toLowerCase().includes(q)) ||
      (log.entityType && log.entityType.toLowerCase().includes(q)) ||
      (log.details && log.details.toLowerCase().includes(q))
    )
  }, [logs, searchQuery])

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1
  const displayedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden space-y-6">
      <PageHeader
        title="Journal d'Audit"
        description="Traçabilité et conformité réglementaire des actions critiques du système"
      />

      <div className="flex items-center justify-between gap-4">
        <SearchBar
          value={searchQuery}
          onChange={(val) => {
            setSearchQuery(val)
            setCurrentPage(1)
          }}
          placeholder="Filtrer par utilisateur, action, entité ou détail..."
          className="max-w-md"
        />
        <div className="text-xs text-muted-foreground tabular-nums">
          {filteredLogs.length} événement(s) enregistré(s)
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card border-border shadow-sm">
        <CardHeader className="py-4 px-6 border-b border-border/40">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-base font-semibold">Événements d'audit horodatés</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-0">
          <div className="flex-1 overflow-auto min-h-0">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[180px]">Date & Heure</TableHead>
                  <TableHead className="w-[180px]">Utilisateur</TableHead>
                  <TableHead className="w-[120px]">Action</TableHead>
                  <TableHead className="w-[140px]">Entité</TableHead>
                  <TableHead>Détails de l'événement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">{log.userName || 'Système'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.action === 'DELETE'
                            ? 'destructive'
                            : log.action === 'CREATE'
                            ? 'default'
                            : 'secondary'
                        }
                        className="text-[11px] font-semibold"
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-sm font-medium">{log.entityType}</TableCell>
                    <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                      {log.details || '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {displayedLogs.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      {searchQuery ? "Aucun événement ne correspond à votre recherche." : "Aucun journal d'audit disponible."}
                    </TableCell>
                  </TableRow>
                )}
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      Chargement des événements d'audit...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="p-4 border-t border-border">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
