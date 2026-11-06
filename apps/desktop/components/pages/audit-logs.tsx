"use client"

import { getPaginatedAuditLogs } from "@/app/actions/audit.actions"
import * as React from "react"
import { ShieldCheck, User, CloudDownload } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { PageHeader } from "@/components/features/common/PageHeader"
import { SortSelect } from "@/components/features/common/SortSelect"
import { DataExportModal } from "@/components/features/export/DataExportModal"
import { SearchBar } from "@workspace/ui/components/search-bar"
import { Pagination } from "@workspace/ui/components/pagination-custom"
import { cn } from "@/lib/utils"
import {
  formatAuditAction,
  formatAuditEntity,
  formatAuditDetails,
  formatAuditDateTimeFr,
} from "@/lib/utils/auditFormatter"
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
  const [totalCount, setTotalCount] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [actionFilter, setActionFilter] = React.useState<string>("ALL")
  const [entityFilter, setEntityFilter] = React.useState<string>("ALL")
  const [sortValue, setSortValue] = React.useState<string>("recent")
  const sortOrder: "desc" | "asc" = sortValue === "oldest" ? "asc" : "desc"
  const [currentPage, setCurrentPage] = React.useState(1)
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false)
  const itemsPerPage = 10

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  React.useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true)
      try {
        const res = await getPaginatedAuditLogs(
          currentPage,
          itemsPerPage,
          debouncedSearch,
          actionFilter,
          entityFilter,
          sortOrder
        )

        if (!res.success) {
          if (res.error === "Unauthorized") {
            toast.error("Accès non autorisé ou session expirée pour le journal d'audit")
          } else {
            toast.error(res.error || "Erreur lors du chargement des logs")
          }
          return
        }

        if (res.data) {
          setLogs(res.data.logs as AuditLogItem[])
          setTotalCount(res.data.totalCount)
        }
      } catch (err) {
        console.error("[AuditLogsPage] Fetch error:", err)
        toast.error("Impossible de récupérer les logs d'audit")
      } finally {
        setIsLoading(false)
      }
    }

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
    }

    fetchTimeoutRef.current = setTimeout(() => {
      fetchLogs()
    }, 100)

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current)
    }
  }, [currentPage, itemsPerPage, debouncedSearch, actionFilter, entityFilter, sortOrder])

  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1
  const safePage = Math.min(currentPage, Math.max(1, totalPages))

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages))
    }
  }, [currentPage, totalPages])
  const displayedLogs = logs

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 pb-4 border-b border-border bg-background z-10 space-y-4">
        <PageHeader
          title="Journal d'Audit"
          description="Traçabilité et conformité réglementaire des actions critiques du système"
          actions={
            <Button
              variant="outline"
              onClick={() => setIsExportModalOpen(true)}
              className="gap-2 cursor-pointer"
            >
              <CloudDownload className="w-4 h-4" />
              Export Excel
            </Button>
          }
        />

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            <div className="relative flex-1 min-w-[280px] sm:min-w-[360px]">
              <SearchBar
                value={searchQuery}
                onChange={(val) => {
                  setSearchQuery(val)
                  setCurrentPage(1)
                }}
                placeholder="Rechercher par utilisateur, action, entité ou détail..."
                className="w-full"
              />
            </div>

            <Select
              value={actionFilter}
              onValueChange={(val) => {
                setActionFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-[175px] h-10 text-xs bg-card border-border">
                <SelectValue placeholder="Toutes les actions" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="ALL">Toutes les actions</SelectItem>
                <SelectItem value="CREATE">Création</SelectItem>
                <SelectItem value="UPDATE">Modification</SelectItem>
                <SelectItem value="DELETE">Suppression</SelectItem>
                <SelectItem value="SHARE">Partage</SelectItem>
                <SelectItem value="LOGIN">Connexion</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={entityFilter}
              onValueChange={(val) => {
                setEntityFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px] h-10 text-xs bg-card border-border">
                <SelectValue placeholder="Toutes les entités" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="ALL">Toutes les entités</SelectItem>
                <SelectItem value="invoice">Facture</SelectItem>
                <SelectItem value="quote">Devis</SelectItem>
                <SelectItem value="credit_note">Avoir</SelectItem>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="stock">Stock</SelectItem>
                <SelectItem value="ledger">Livre des comptes</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="user">Utilisateur</SelectItem>
                <SelectItem value="settings">Paramètres</SelectItem>
              </SelectContent>
            </Select>

            <SortSelect
              value={sortValue}
              onValueChange={(val) => {
                setSortValue(val)
                setCurrentPage(1)
              }}
              type="standard"
            />
          </div>

          <div className="text-xs text-muted-foreground tabular-nums shrink-0 font-medium">
            {isLoading ? "Chargement..." : `${totalCount} événement(s) enregistré(s)`}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pt-4 pr-1">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="py-4 px-6 border-b border-border/40">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-semibold">Événements d&apos;audit horodatés</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[190px]">Date &amp; Heure</TableHead>
                  <TableHead className="w-[180px]">Utilisateur</TableHead>
                  <TableHead className="w-[150px]">Action</TableHead>
                  <TableHead className="w-[150px]">Entité</TableHead>
                  <TableHead>Détails de l&apos;événement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedLogs.map((log) => {
                  const actionInfo = formatAuditAction(log.action)
                  const entityLabel = formatAuditEntity(log.entityType)
                  const detailsInfo = formatAuditDetails(log.details)

                  return (
                    <TableRow key={log.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatAuditDateTimeFr(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">
                            {log.userName || "Système"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            actionInfo.variant === "destructive"
                              ? "destructive"
                              : actionInfo.variant === "success" ||
                                actionInfo.variant === "info" ||
                                actionInfo.variant === "default" ||
                                actionInfo.variant === "warning"
                              ? "default"
                              : "secondary"
                          }
                          className={cn(
                            "text-[11px] font-semibold",
                            actionInfo.variant === "success" && "bg-emerald-600 hover:bg-emerald-600 text-white",
                            actionInfo.variant === "info" && "bg-blue-600 hover:bg-blue-600 text-white",
                            actionInfo.variant === "warning" && "bg-amber-600 hover:bg-amber-600 text-white",
                            actionInfo.variant === "default" && "bg-indigo-600 hover:bg-indigo-600 text-white"
                          )}
                        >
                          {actionInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-foreground whitespace-nowrap">
                        {entityLabel}
                      </TableCell>
                      <TableCell className="max-w-xl text-sm text-foreground/90 whitespace-normal break-words">
                        <span title={detailsInfo.humanText} className="line-clamp-2 break-all sm:break-words">
                          {detailsInfo.humanText}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {displayedLogs.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      {searchQuery || actionFilter !== "ALL" || entityFilter !== "ALL"
                        ? "Aucun événement ne correspond à vos critères de filtrage."
                        : "Aucun journal d'audit disponible."}
                    </TableCell>
                  </TableRow>
                )}
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      Chargement des événements d&apos;audit...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="shrink-0 pt-3 border-t border-border bg-background">
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      <DataExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        initialEntity="audit"
      />
    </div>
  )
}
