"use client";

import * as React from "react";
import { Download, FileSpreadsheet, FileText, Calendar, CheckCircle2, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { useStore, type Invoice, type Quote, type CreditNote } from "@/lib/store";
import { formatCurrency, downloadSafeCsv } from "@/lib/utils";
import { exportInvoicesToExcel, exportQuotesToExcel } from "@/lib/services/ExportService";
import { toast } from "sonner";

export type ExportScope = "invoices" | "quotes" | "credit-notes" | "clients";
export type ExportPeriod = "all" | "30d" | "quarter" | "year" | "custom";
export type ExportFormat = "xlsx" | "csv";

interface DataExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultScope?: ExportScope;
}

export function DataExportModal({
  open,
  onOpenChange,
  defaultScope = "invoices",
}: DataExportModalProps) {
  const invoices = useStore((s) => s.invoices || []);
  const quotes = useStore((s) => s.quotes || []);
  const creditNotes = useStore((s) => s.creditNotes || []);
  const clients = useStore((s) => s.clients || []);
  const [scope, setScope] = React.useState<ExportScope>(defaultScope);
  const [period, setPeriod] = React.useState<ExportPeriod>("all");
  const [format, setFormat] = React.useState<ExportFormat>("xlsx");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");
  const [isExporting, setIsExporting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setScope(defaultScope);
      setStatusFilter("all");
    }
  }, [open, defaultScope]);

  const dateBounds = React.useMemo(() => {
    const now = new Date();
    if (period === "30d") {
      const s = new Date(now.getTime() - 30 * 86400000);
      return { start: s.toISOString().split("T")[0], end: now.toISOString().split("T")[0] };
    }
    if (period === "quarter") {
      const s = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return { start: s.toISOString().split("T")[0], end: now.toISOString().split("T")[0] };
    }
    if (period === "year") {
      return { start: `${now.getFullYear()}-01-01`, end: now.toISOString().split("T")[0] };
    }
    if (period === "custom") return { start: startDate, end: endDate };
    return null;
  }, [period, startDate, endDate]);

  const filteredData = React.useMemo(() => {
    const inRange = (dStr?: string) => {
      if (!dateBounds || !dStr) return true;
      const d = dStr.split("T")[0];
      return (!dateBounds.start || d >= dateBounds.start) && (!dateBounds.end || d <= dateBounds.end);
    };

    if (scope === "invoices") {
      return invoices.filter((i) => {
        if (i.deletedAt || !inRange(i.date)) return false;
        if (statusFilter === "all") return true;
        if (statusFilter === "draft") return i.status === "draft" || (i.status as string) === "BROUILLON";
        if (statusFilter === "unpaid_any") return i.status === "UNPAID" || i.status === "PARTIALLY_PAID" || i.status === "overdue";
        if (statusFilter === "overdue") {
          const past = i.dueDate ? new Date(i.dueDate).getTime() < Date.now() : false;
          return i.status === "overdue" || (past && i.status !== "PAID");
        }
        return i.status === statusFilter;
      });
    }
    if (scope === "quotes") {
      return quotes.filter((q) => {
        if (q.deletedAt || !inRange(q.date)) return false;
        if (statusFilter === "all") return true;
        if (statusFilter === "draft") return (q.status as string) === "draft" || (q.status as string) === "BROUILLON";
        if (statusFilter === "pending") return q.status === "EN_ATTENTE" || (q.status as string) === "ENVOYE" || (q.status as string) === "sent";
        if (statusFilter === "CONVERTI") return q.status === "CONVERTI";
        if (statusFilter === "refused_expired") return q.status === "REFUSE" || q.status === "EXPIRE" || (q.status as string) === "EXPIRED";
        return q.status === statusFilter;
      });
    }
    if (scope === "credit-notes") return creditNotes.filter((cn) => inRange(cn.date));
    return clients.filter((c) => !c.deletedAt);
  }, [scope, invoices, quotes, creditNotes, clients, dateBounds, statusFilter]);

  const totalAmount = React.useMemo(() => {
    if (scope === "clients") return null;
    return (filteredData as Array<{ total: number }>).reduce((sum, item) => sum + (item.total || 0), 0);
  }, [filteredData, scope]);

  const handleExecuteExport = async () => {
    if (filteredData.length === 0) {
      toast.error("Aucune donnée ne correspond aux critères sélectionnés.");
      return;
    }
    setIsExporting(true);
    const tag = new Date().toISOString().split("T")[0];
    try {
      if (format === "xlsx" && scope === "invoices") {
        await exportInvoicesToExcel(filteredData as Invoice[]);
      } else if (format === "xlsx" && scope === "quotes") {
        await exportQuotesToExcel(filteredData as Quote[]);
      } else {
        const fileTag = `${scope}_${tag}.csv`;
        if (scope === "invoices") {
          const rows = (filteredData as Invoice[]).map((i) => [i.number, i.clientName, i.date, i.dueDate || "—", i.total, i.status]);
          downloadSafeCsv(fileTag, ["Numéro", "Client", "Date", "Échéance", "Total (FCFA)", "Statut"], rows);
        } else if (scope === "quotes") {
          const rows = (filteredData as Quote[]).map((q) => [q.number, q.clientName, q.date, q.validUntil || "—", q.total, q.status]);
          downloadSafeCsv(fileTag, ["Numéro", "Client", "Date", "Validité", "Total (FCFA)", "Statut"], rows);
        } else if (scope === "credit-notes") {
          const rows = (filteredData as CreditNote[]).map((cn) => [cn.number, cn.invoiceId, cn.clientName, cn.date, cn.reason || "—", cn.total, "Remboursé / Déduit"]);
          downloadSafeCsv(fileTag, ["Numéro Avoir", "Facture Liée", "Client", "Date", "Motif", "Total (FCFA)", "Statut"], rows);
        } else {
          const rows = clients.map((c) => [c.name, c.email || "—", c.phone || "—", c.address || "—", c.nif || "—", c.rccm || "—"]);
          downloadSafeCsv(fileTag, ["Nom", "Email", "Téléphone", "Adresse", "NIF", "RCCM"], rows);
        }
      }
      toast.success(`Export terminé : ${filteredData.length} élément(s) exporté(s)`);
      onOpenChange(false);
    } catch (err) {
      console.error("[DataExportModal] Export error:", err);
      toast.error("Erreur lors de la génération de l'export.");
    } finally {
      setIsExporting(false);
    }
  };

  const invoiceStatuses = [
    { id: "all", label: "Tous" }, { id: "PAID", label: "Payées" }, { id: "unpaid_any", label: "À encaisser" },
    { id: "overdue", label: "En retard" }, { id: "draft", label: "Brouillons" }, { id: "cancelled", label: "Annulées" },
  ];
  const quoteStatuses = [
    { id: "all", label: "Tous" }, { id: "pending", label: "En attente" }, { id: "CONVERTI", label: "Convertis" },
    { id: "draft", label: "Brouillons" }, { id: "refused_expired", label: "Refusés / Expirés" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">Centre d&apos;Exportation</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Personnalisez le périmètre et le format des données à exporter
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {/* Périmètre */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Données</Label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "invoices", label: "Factures", count: invoices.length },
                { id: "quotes", label: "Devis", count: quotes.length },
                { id: "credit-notes", label: "Avoirs", count: creditNotes.length },
                { id: "clients", label: "Clients", count: clients.length },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setScope(item.id as ExportScope); setStatusFilter("all"); }}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    scope === item.id ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs" : "bg-secondary/40 border-border hover:bg-secondary/80 text-foreground"
                  }`}
                >
                  <p className="text-xs">{item.label}</p>
                  <span className="text-[10px] opacity-80 tabular-nums">({item.count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Période */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Période
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "all", label: "Tout l'historique" }, { id: "30d", label: "30 jours" },
                { id: "quarter", label: "Trimestre" }, { id: "year", label: "Année 2026" },
                { id: "custom", label: "Dates précises..." },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id as ExportPeriod)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${period === p.id ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {period === "custom" && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs p-1.5 bg-secondary border border-border rounded-lg text-foreground" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs p-1.5 bg-secondary border border-border rounded-lg text-foreground" />
              </div>
            )}
          </div>

          {/* Filtre statut */}
          {(scope === "invoices" || scope === "quotes") && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Statut
              </Label>
              <div className="flex flex-wrap gap-1">
                {(scope === "invoices" ? invoiceStatuses : quoteStatuses).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id)}
                    className={`px-2 py-0.5 text-xs rounded-md font-medium cursor-pointer ${statusFilter === st.id ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"}`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Format */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Format</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat("xlsx")}
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer ${format === "xlsx" ? "border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold" : "border-border bg-secondary/30 text-muted-foreground"}`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="text-left text-xs"><p className="font-bold">Excel (.xlsx)</p><p className="text-[10px] opacity-80">Mise en page charte</p></div>
              </button>
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer ${format === "csv" ? "border-blue-600 bg-blue-500/10 text-blue-700 dark:text-blue-400 font-semibold" : "border-border bg-secondary/30 text-muted-foreground"}`}
              >
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="text-left text-xs"><p className="font-bold">CSV (.csv)</p><p className="text-[10px] opacity-80">Format tableur OHADA</p></div>
              </button>
            </div>
          </div>

          {/* Résumé */}
          <div className="p-2.5 bg-secondary/50 rounded-xl border border-border flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground">{filteredData.length} élément(s) à exporter</span>
            </div>
            {totalAmount !== null && (
              <span className="font-mono font-bold text-foreground tabular-nums">{formatCurrency(totalAmount)}</span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isExporting}>Annuler</Button>
          <Button size="sm" onClick={handleExecuteExport} disabled={isExporting || filteredData.length === 0} className="gap-2 bg-primary text-primary-foreground font-semibold">
            <Download className="w-3.5 h-3.5" />
            {isExporting ? "Export..." : "Télécharger l'export"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
