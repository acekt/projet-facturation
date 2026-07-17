"use client"

import * as React from "react"
import { ShieldCheck, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Pagination } from "@/components/ui/pagination-custom"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"

export function AuditLogsPage() {
  const [logs, setLogs] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10

  React.useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/audit-logs')
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          console.warn('[AuditLogsPage] API response not ok:', res.status, errorData)
          if (res.status === 401 || res.status === 403) {
            toast.error("Accès non autorisé ou session expirée pour le journal d'audit")
          } else {
            toast.error(errorData.error || `Erreur lors du chargement des logs (${res.status})`)
          }
          return
        }
        
        const data = await res.json()
        if (!data.error && Array.isArray(data)) {
          setLogs(data)
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Journal d'Audit</h1>
        <p className="text-muted-foreground mt-1">Traçabilité des actions critiques du système</p>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Événements récents</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-auto min-h-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entité</TableHead>
                  <TableHead>Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{log.userName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.action === 'DELETE' ? 'destructive' : 'secondary'}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{log.entityType}</TableCell>
                    <TableCell className="max-w-md truncate text-sm">
                      {log.details}
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      Aucun log d'audit disponible.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="pt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(logs.length / itemsPerPage)}
              onPageChange={setCurrentPage}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
