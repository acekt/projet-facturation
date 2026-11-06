"use client";

import * as React from "react";
import { Download, FileSpreadsheet, FileText, Calendar, CheckCircle2, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { useStore, type Invoice, type Quote, type CreditNote, type Service } from "@/lib/store";
import { formatCurrency, downloadSafeCsv } from "@/lib/utils";
import {
  downloadStyledExcel,
  formatExcelDateFr,
  resolveCreditNoteInvoiceNumber,
} from "@/lib/utils/excel-export";
import { getLedgerEntriesAction } from "@/app/actions/ledger.actions";
import { getStockCatalog } from "@/app/actions/stock.actions";
import { getAuditLogs } from "@/app/actions/audit.actions";
import {
  formatAuditAction,
  formatAuditEntity,
  formatAuditDetails,
  formatAuditDateTimeFr,
} from "@/lib/utils/auditFormatter";
import type { LedgerEntry } from "@/lib/repositories/LedgerRepository";
import { toast } from "sonner";

export type ExportScope =
  | "invoices"
  | "quotes"
  | "credit-notes"
  | "credit_notes"
  | "clients"
  | "services"
  | "stock"
  | "ledger"
  | "audit"
  | "audit-logs";

export type NormalizedExportScope =
  | "invoices"
  | "quotes"
  | "credit-notes"
  | "clients"
  | "services"
  | "stock"
  | "ledger"
  | "audit";

export type ExportPeriod = "all" | "30d" | "quarter" | "year" | "custom";
export type ExportFormat = "xlsx" | "csv";

export interface DataExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultScope?: ExportScope;
  initialEntity?: ExportScope;
}

function normalizeScope(s?: ExportScope): NormalizedExportScope {
  if (!s) return "invoices";
  if (s === "credit_notes") return "credit-notes";
  if (s === "audit-logs") return "audit";
  return s;
}

function translateInvoiceStatusFr(status?: string): string {
  switch ((status || "").toUpperCase()) {
    case "PAID":
    case "PAYEE":
      return "Payée";
    case "PARTIALLY_PAID":
      return "Partiellement payée";
    case "OVERDUE":
      return "En retard";
    case "DRAFT":
    case "BROUILLON":
      return "Brouillon";
    case "CANCELLED":
    case "ANNULEE":
      return "Annulée";
    default:
      return "Impayée";
  }
}

function translateQuoteStatusFr(status?: string): string {
  switch ((status || "").toUpperCase()) {
    case "CONVERTI":
      return "Converti en facture";
    case "EN_ATTENTE":
    case "ENVOYE":
    case "SENT":
      return "En attente";
    case "REFUSE":
    case "REJECTED":
      return "Refusé";
    case "EXPIRE":
    case "EXPIRED":
      return "Expiré";
    case "DRAFT":
    case "BROUILLON":
      return "Brouillon";
    default:
      return status || "En attente";
  }
}

function getPhysicalStockTitle(item: { name: string; stockItemName?: string | null }): string {
  if (item.stockItemName && item.stockItemName.trim() !== "") {
    return item.stockItemName.trim();
  }
  const cleaned = (item.name || "")
    .trim()
    .replace(
      /^(achat\s+et\s+installation\s+d['’]|achat\s+et\s+installation\s+de\s+|achat\s+d['’]|achat\s+de\s+|achat\s+|fourniture\s+et\s+pose\s+d['’]|fourniture\s+et\s+pose\s+de\s+|fourniture\s+d['’]|fourniture\s+de\s+|vente\s+d['’]|vente\s+de\s+)/i,
      ""
    )
    .trim();
  if (!cleaned) return item.name;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function DataExportModal({
  open,
  onOpenChange,
  defaultScope,
  initialEntity,
}: DataExportModalProps) {
  const resolvedInitial = normalizeScope(initialEntity || defaultScope || "invoices");

  const invoices = useStore((s) => s.invoices || []);
  const quotes = useStore((s) => s.quotes || []);
  const creditNotes = useStore((s) => s.creditNotes || []);
  const clients = useStore((s) => s.clients || []);
  const services = useStore((s) => s.services || []);
  const cachedStockCatalog = useStore((s) => s.stockCatalog || []);
  const settings = useStore((s) => s.settings);

  const [scope, setScope] = React.useState<NormalizedExportScope>(resolvedInitial);
  const [period, setPeriod] = React.useState<ExportPeriod>("all");
  const [format, setFormat] = React.useState<ExportFormat>("xlsx");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");
  const [isExporting, setIsExporting] = React.useState(false);

  const [ledgerEntries, setLedgerEntries] = React.useState<LedgerEntry[]>([]);
  const [stockItems, setStockItems] = React.useState<any[]>(() => cachedStockCatalog);
  const [auditLogs, setAuditLogs] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (open) {
      setScope(normalizeScope(initialEntity || defaultScope || "invoices"));
      setStatusFilter("all");
      if (cachedStockCatalog && cachedStockCatalog.length > 0) {
        setStockItems(cachedStockCatalog);
      }
      getLedgerEntriesAction({})
        .then((res) => {
          if (res.success && res.data) {
            setLedgerEntries(res.data);
          }
        })
        .catch(() => {});
      getStockCatalog()
        .then((res) => {
          if (res.success && res.data) {
            setStockItems(res.data);
          }
        })
        .catch(() => {});
      getAuditLogs()
        .then((res) => {
          if (res.success && res.data) {
            setAuditLogs(res.data);
          }
        })
        .catch(() => {});
    }
  }, [open, defaultScope, initialEntity]);

  const effectiveStockCatalog = React.useMemo(() => {
    if (stockItems.length > 0) return stockItems;
    if (cachedStockCatalog.length > 0) return cachedStockCatalog;
    return services.filter((s) => Boolean(s.trackStock) && !(s as any).deletedAt);
  }, [stockItems, cachedStockCatalog, services]);

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
    if (scope === "credit-notes") {
      return creditNotes.filter((cn) => !cn.deletedAt && inRange(cn.date));
    }
    if (scope === "services") {
      return services.filter((s) => !(s as any).deletedAt);
    }
    if (scope === "stock") {
      return effectiveStockCatalog.filter((item) => {
        const qty = Number(item.stockQuantity || 0);
        const minAlert = Number(item.minStockAlert || 0);
        if (statusFilter === "in_stock") return qty > minAlert;
        if (statusFilter === "low_stock") return qty > 0 && qty <= minAlert;
        if (statusFilter === "out_of_stock") return qty <= 0;
        return true;
      });
    }
    if (scope === "ledger") {
      return ledgerEntries.filter((entry) => {
        if (!inRange(entry.date)) return false;
        if (statusFilter === "IN") return entry.type === "IN";
        if (statusFilter === "OUT") return entry.type === "OUT";
        return true;
      });
    }
    if (scope === "audit") {
      return auditLogs.filter((log) => {
        if (!inRange(log.createdAt)) return false;
        if (statusFilter !== "all" && log.action !== statusFilter) return false;
        return true;
      });
    }
    return clients.filter((c) => !c.deletedAt);
  }, [scope, invoices, quotes, creditNotes, clients, services, effectiveStockCatalog, ledgerEntries, auditLogs, dateBounds, statusFilter]);

  const totalAmount = React.useMemo(() => {
    if (scope === "clients" || scope === "services" || scope === "audit") return null;
    if (scope === "stock") {
      return (filteredData as any[]).reduce(
        (sum, item) => sum + Number(item.stockQuantity || 0) * Number(item.unitPrice || 0),
        0
      );
    }
    if (scope === "ledger") {
      return (filteredData as LedgerEntry[]).reduce(
        (sum, entry) => sum + (entry.type === "IN" ? entry.amount : -entry.amount),
        0
      );
    }
    return (filteredData as Array<{ total: number }>).reduce((sum, item) => sum + (item.total || 0), 0);
  }, [filteredData, scope]);

  const handleExecuteExport = async () => {
    if (filteredData.length === 0) {
      toast.error("Aucune donnée ne correspond aux critères sélectionnés.");
      return;
    }
    setIsExporting(true);
    const tag = new Date().toISOString().split("T")[0];
    const companyName = settings?.companyName || "Global Maintenance";

    try {
      if (format === "xlsx") {
        if (scope === "invoices") {
          const list = filteredData as Invoice[];
          const rows = list.map((i) => ({
            number: i.number,
            clientName: i.clientName,
            date: i.date,
            dueDate: i.dueDate || "—",
            subtotal: i.subtotal || 0,
            discount: i.discount || 0,
            netHt: Math.max(0, (i.subtotal || 0) - (i.discount || 0)),
            cssAmount: i.cssAmount || 0,
            tpsAmount: i.tpsAmount || 0,
            tvaAmount: i.tvaAmount || 0,
            total: i.total || 0,
            status: translateInvoiceStatusFr(i.status),
          }));
          downloadStyledExcel({
            title: "JOURNAL DES FACTURES CLIENTS",
            companyName,
            sheetName: "Factures",
            filename: "factures_clients",
            columns: [
              { header: "Numéro Facture", key: "number", width: 140, type: "string" },
              { header: "Client", key: "clientName", width: 200, type: "string" },
              { header: "Date d'émission", key: "date", width: 100, type: "date", align: "center" },
              { header: "Échéance", key: "dueDate", width: 100, type: "date", align: "center" },
              { header: "Brut HT", key: "subtotal", width: 125, type: "currency", align: "right" },
              { header: "Remise", key: "discount", width: 110, type: "currency", align: "right" },
              { header: "Net HT", key: "netHt", width: 125, type: "currency", align: "right" },
              { header: "CSS (1%)", key: "cssAmount", width: 105, type: "currency", align: "right" },
              { header: "TPS (9.5%)", key: "tpsAmount", width: 105, type: "currency", align: "right" },
              { header: "TVA (18%)", key: "tvaAmount", width: 115, type: "currency", align: "right" },
              { header: "Total TTC", key: "total", width: 140, type: "currency", align: "right" },
              { header: "Statut", key: "status", width: 135, type: "string", align: "center" },
            ],
            rows,
            totalsRow: {
              number: "TOTAL GÉNÉRAL",
              subtotal: rows.reduce((s, r) => s + r.subtotal, 0),
              discount: rows.reduce((s, r) => s + r.discount, 0),
              netHt: rows.reduce((s, r) => s + r.netHt, 0),
              cssAmount: rows.reduce((s, r) => s + r.cssAmount, 0),
              tpsAmount: rows.reduce((s, r) => s + r.tpsAmount, 0),
              tvaAmount: rows.reduce((s, r) => s + r.tvaAmount, 0),
              total: rows.reduce((s, r) => s + r.total, 0),
            },
          });
        } else if (scope === "quotes") {
          const list = filteredData as Quote[];
          const rows = list.map((q) => {
            const brutHt = q.subtotal || q.taxBase || 0;
            const discount = q.discount || 0;
            return {
              number: q.number,
              clientName: q.clientName,
              date: q.date,
              validUntil: q.validUntil || "—",
              subtotal: brutHt,
              discount,
              netHt: Math.max(0, brutHt - discount),
              cssAmount: q.cssAmount || 0,
              tpsAmount: q.tpsAmount || 0,
              tvaAmount: q.tvaAmount || 0,
              total: q.total || 0,
              status: translateQuoteStatusFr(q.status),
            };
          });
          downloadStyledExcel({
            title: "JOURNAL DES DEVIS COMMERCIAUX",
            companyName,
            sheetName: "Devis",
            filename: "devis_commerciaux",
            columns: [
              { header: "Numéro Devis", key: "number", width: 140, type: "string" },
              { header: "Client", key: "clientName", width: 200, type: "string" },
              { header: "Date d'émission", key: "date", width: 100, type: "date", align: "center" },
              { header: "Validité", key: "validUntil", width: 100, type: "date", align: "center" },
              { header: "Brut HT", key: "subtotal", width: 125, type: "currency", align: "right" },
              { header: "Remise", key: "discount", width: 110, type: "currency", align: "right" },
              { header: "Net HT", key: "netHt", width: 125, type: "currency", align: "right" },
              { header: "CSS (1%)", key: "cssAmount", width: 105, type: "currency", align: "right" },
              { header: "TPS (9.5%)", key: "tpsAmount", width: 105, type: "currency", align: "right" },
              { header: "TVA (18%)", key: "tvaAmount", width: 115, type: "currency", align: "right" },
              { header: "Total TTC", key: "total", width: 140, type: "currency", align: "right" },
              { header: "Statut", key: "status", width: 140, type: "string", align: "center" },
            ],
            rows,
            totalsRow: {
              number: "TOTAL GÉNÉRAL",
              subtotal: rows.reduce((s, r) => s + r.subtotal, 0),
              discount: rows.reduce((s, r) => s + r.discount, 0),
              netHt: rows.reduce((s, r) => s + r.netHt, 0),
              cssAmount: rows.reduce((s, r) => s + r.cssAmount, 0),
              tpsAmount: rows.reduce((s, r) => s + r.tpsAmount, 0),
              tvaAmount: rows.reduce((s, r) => s + r.tvaAmount, 0),
              total: rows.reduce((s, r) => s + r.total, 0),
            },
          });
        } else if (scope === "credit-notes") {
          const list = filteredData as CreditNote[];
          const rows = list.map((cn) => ({
            number: cn.number,
            invoiceNumber: resolveCreditNoteInvoiceNumber(cn, invoices),
            clientName: cn.clientName,
            date: cn.date,
            reason: cn.reason || "—",
            subtotal: cn.subtotal || 0,
            cssAmount: cn.cssAmount || 0,
            tpsAmount: cn.tpsAmount || 0,
            tvaAmount: cn.tvaAmount || 0,
            total: cn.total || 0,
          }));
          downloadStyledExcel({
            title: "JOURNAL DES AVOIRS ET REMBOURSEMENTS CLIENTS",
            companyName,
            sheetName: "Avoirs",
            filename: "avoirs_clients",
            columns: [
              { header: "Numéro Avoir", key: "number", width: 135, type: "string" },
              { header: "Facture Liée", key: "invoiceNumber", width: 145, type: "string" },
              { header: "Client", key: "clientName", width: 195, type: "string" },
              { header: "Date", key: "date", width: 100, type: "date", align: "center" },
              { header: "Motif légal", key: "reason", width: 240, type: "string" },
              { header: "Sous-total HT", key: "subtotal", width: 130, type: "currency", align: "right" },
              { header: "CSS (1%)", key: "cssAmount", width: 110, type: "currency", align: "right" },
              { header: "TPS (9.5%)", key: "tpsAmount", width: 110, type: "currency", align: "right" },
              { header: "TVA (18%)", key: "tvaAmount", width: 120, type: "currency", align: "right" },
              { header: "Total TTC", key: "total", width: 140, type: "currency", align: "right" },
            ],
            rows,
            totalsRow: {
              number: "TOTAL GÉNÉRAL",
              subtotal: rows.reduce((s, r) => s + r.subtotal, 0),
              cssAmount: rows.reduce((s, r) => s + r.cssAmount, 0),
              tpsAmount: rows.reduce((s, r) => s + r.tpsAmount, 0),
              tvaAmount: rows.reduce((s, r) => s + r.tvaAmount, 0),
              total: rows.reduce((s, r) => s + r.total, 0),
            },
          });
        } else if (scope === "clients") {
          const rows = (filteredData as typeof clients).map((c) => {
            const clientInvoices = invoices.filter(
              (inv) => !inv.deletedAt && (inv.clientId === c.id || inv.clientName === c.name)
            );
            const totalFacture = clientInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
            return {
              name: c.name,
              email: c.email || "—",
              phone: c.phone || "—",
              address: c.address || "—",
              nif: c.nif || "—",
              rccm: c.rccm || "—",
              invoiceCount: clientInvoices.length,
              totalFacture,
            };
          });
          downloadStyledExcel({
            title: "RÉPERTOIRE OFFICIEL DES CLIENTS",
            companyName,
            sheetName: "Clients",
            filename: "repertoire_clients",
            columns: [
              { header: "Raison Sociale / Nom", key: "name", width: 220, type: "string" },
              { header: "Email", key: "email", width: 190, type: "string" },
              { header: "Téléphone", key: "phone", width: 135, type: "string" },
              { header: "Adresse", key: "address", width: 230, type: "string" },
              { header: "NIF", key: "nif", width: 130, type: "string" },
              { header: "RCCM", key: "rccm", width: 145, type: "string" },
              { header: "Nb Factures", key: "invoiceCount", width: 95, type: "number", align: "right" },
              { header: "Chiffre d'Affaires TTC", key: "totalFacture", width: 155, type: "currency", align: "right" },
            ],
            rows,
            totalsRow: {
              name: "TOTAL GÉNÉRAL",
              invoiceCount: rows.reduce((s, r) => s + r.invoiceCount, 0),
              totalFacture: rows.reduce((s, r) => s + r.totalFacture, 0),
            },
          });
        } else if (scope === "services") {
          const rows = (filteredData as Service[]).map((s) => ({
            name: s.name,
            stockItemName: s.trackStock ? ((s as any).stockItemName || s.name) : "Non suivi",
            category: s.category || "Général",
            unit: s.unit || "Unité",
            unitPrice: Number(s.unitPrice || 0),
            stockQuantity: s.trackStock ? Number(s.stockQuantity || 0) : 0,
            description: s.description || "—",
          }));
          downloadStyledExcel({
            title: "CATALOGUE OFFICIEL DES SERVICES ET PRESTATIONS",
            companyName,
            sheetName: "Services",
            filename: "catalogue_services",
            columns: [
              { header: "Désignation commerciale", key: "name", width: 230, type: "string" },
              { header: "Article en stock lié", key: "stockItemName", width: 180, type: "string" },
              { header: "Catégorie", key: "category", width: 150, type: "string" },
              { header: "Unité", key: "unit", width: 90, type: "string", align: "center" },
              { header: "Prix Unitaire HT", key: "unitPrice", width: 145, type: "currency", align: "right" },
              { header: "Qté en stock", key: "stockQuantity", width: 100, type: "number", align: "right" },
              { header: "Description", key: "description", width: 250, type: "string" },
            ],
            rows,
          });
        } else if (scope === "stock") {
          const rows = (filteredData as any[]).map((item) => ({
            stockItemName: getPhysicalStockTitle(item),
            serviceName: item.name,
            category: item.category || "Prestation",
            stockQuantity: Number(item.stockQuantity || 0),
            minStockAlert: Number(item.minStockAlert || 0),
            unit: item.unit || "Unité",
            unitPrice: Number(item.unitPrice || 0),
            stockValue: Number(item.stockQuantity || 0) * Number(item.unitPrice || 0),
          }));
          downloadStyledExcel({
            title: "ÉTAT DES STOCKS ET VALORISATION D'INVENTAIRE",
            companyName,
            sheetName: "Inventaire Stock",
            filename: "etat_des_stocks",
            columns: [
              { header: "Article en stock (Nom physique)", key: "stockItemName", width: 210, type: "string" },
              { header: "Service commercial lié", key: "serviceName", width: 220, type: "string" },
              { header: "Catégorie", key: "category", width: 140, type: "string" },
              { header: "Quantité en stock", key: "stockQuantity", width: 110, type: "number", align: "right" },
              { header: "Seuil d'alerte", key: "minStockAlert", width: 95, type: "number", align: "right" },
              { header: "Unité", key: "unit", width: 85, type: "string", align: "center" },
              { header: "Prix Unitaire HT", key: "unitPrice", width: 130, type: "currency", align: "right" },
              { header: "Valorisation Totale", key: "stockValue", width: 145, type: "currency", align: "right" },
            ],
            rows,
            totalsRow: {
              stockItemName: "TOTAL GÉNÉRAL",
              stockQuantity: rows.reduce((s, r) => s + r.stockQuantity, 0),
              stockValue: rows.reduce((s, r) => s + r.stockValue, 0),
            },
          });
        } else if (scope === "ledger") {
          const list = filteredData as LedgerEntry[];
          const rows = list.map((e) => ({
            date: e.date,
            nature: e.type === "IN" ? "Entrée (Recette)" : "Sortie (Dépense)",
            category: e.category,
            description: e.description,
            counterparty: e.counterparty || "—",
            paymentMethod: e.paymentMethod,
            reference: e.reference || "—",
            amountIn: e.type === "IN" ? e.amount : 0,
            amountOut: e.type === "OUT" ? e.amount : 0,
            signedAmount: e.type === "IN" ? e.amount : -e.amount,
          }));
          const totalIn = rows.reduce((s, r) => s + r.amountIn, 0);
          const totalOut = rows.reduce((s, r) => s + r.amountOut, 0);
          downloadStyledExcel({
            title: "LIVRE DES COMPTES ET JOURNAL DE TRÉSORERIE",
            companyName,
            sheetName: "Livre des Comptes",
            filename: "livre_des_comptes",
            columns: [
              { header: "Date", key: "date", width: 100, type: "date", align: "center" },
              { header: "Nature", key: "nature", width: 135, type: "string", align: "center" },
              { header: "Catégorie", key: "category", width: 165, type: "string" },
              { header: "Libellé / Motif", key: "description", width: 250, type: "string" },
              { header: "Tiers / Bénéficiaire", key: "counterparty", width: 165, type: "string" },
              { header: "Mode de règlement", key: "paymentMethod", width: 130, type: "string", align: "center" },
              { header: "Référence pièce", key: "reference", width: 140, type: "string", align: "center" },
              { header: "Entrée (Recette)", key: "amountIn", width: 135, type: "currency", align: "right" },
              { header: "Sortie (Dépense)", key: "amountOut", width: 135, type: "currency", align: "right" },
              { header: "Solde Net", key: "signedAmount", width: 140, type: "currency", align: "right" },
            ],
            rows,
            totalsRow: {
              date: "TOTAL GÉNÉRAL",
              amountIn: totalIn,
              amountOut: totalOut,
              signedAmount: totalIn - totalOut,
            },
          });
        } else if (scope === "audit") {
          const rows = (filteredData as any[]).map((log) => ({
            date: formatAuditDateTimeFr(log.createdAt),
            userName: log.userName || "Système",
            action: formatAuditAction(log.action).label,
            entity: formatAuditEntity(log.entityType),
            details: formatAuditDetails(log.details).humanText,
          }));
          downloadStyledExcel({
            title: "JOURNAL D'AUDIT ET DE TRAÇABILITÉ SYSTÈME",
            companyName,
            sheetName: "Journal Audit",
            filename: "journal_audit",
            columns: [
              { header: "Horodatage", key: "date", width: 155, type: "string", align: "center" },
              { header: "Utilisateur", key: "userName", width: 160, type: "string" },
              { header: "Action", key: "action", width: 130, type: "string", align: "center" },
              { header: "Module / Entité", key: "entity", width: 140, type: "string", align: "center" },
              { header: "Détails de l'opération", key: "details", width: 330, type: "string" },
            ],
            rows,
          });
        }
      } else {
        // Export CSV UTF-8 BOM (\uFEFF) + séparateur point-virgule (;) + dates JJ/MM/AAAA
        const fileTag = `${scope}_${tag}.csv`;
        if (scope === "invoices") {
          const list = filteredData as Invoice[];
          const rows: Array<Array<string | number>> = list.map((i) => [
            i.number,
            i.clientName,
            formatExcelDateFr(i.date),
            i.dueDate ? formatExcelDateFr(i.dueDate) : "—",
            i.subtotal || 0,
            i.discount || 0,
            Math.max(0, (i.subtotal || 0) - (i.discount || 0)),
            i.cssAmount || 0,
            i.tpsAmount || 0,
            i.tvaAmount || 0,
            i.total || 0,
            translateInvoiceStatusFr(i.status),
          ]);
          rows.push([
            "TOTAL GÉNÉRAL",
            `${list.length} facture(s)`,
            "",
            "",
            list.reduce((s, i) => s + (i.subtotal || 0), 0),
            list.reduce((s, i) => s + (i.discount || 0), 0),
            list.reduce((s, i) => s + Math.max(0, (i.subtotal || 0) - (i.discount || 0)), 0),
            list.reduce((s, i) => s + (i.cssAmount || 0), 0),
            list.reduce((s, i) => s + (i.tpsAmount || 0), 0),
            list.reduce((s, i) => s + (i.tvaAmount || 0), 0),
            list.reduce((s, i) => s + (i.total || 0), 0),
            "",
          ]);
          downloadSafeCsv(
            fileTag,
            [
              "Numéro Facture",
              "Client",
              "Date d'émission",
              "Échéance",
              "Brut HT (FCFA)",
              "Remise (FCFA)",
              "Net HT (FCFA)",
              "CSS 1% (FCFA)",
              "TPS 9.5% (FCFA)",
              "TVA 18% (FCFA)",
              "Total TTC (FCFA)",
              "Statut",
            ],
            rows
          );
        } else if (scope === "quotes") {
          const list = filteredData as Quote[];
          const rows: Array<Array<string | number>> = list.map((q) => {
            const brutHt = q.subtotal || q.taxBase || 0;
            const discount = q.discount || 0;
            return [
              q.number,
              q.clientName,
              formatExcelDateFr(q.date),
              q.validUntil ? formatExcelDateFr(q.validUntil) : "—",
              brutHt,
              discount,
              Math.max(0, brutHt - discount),
              q.cssAmount || 0,
              q.tpsAmount || 0,
              q.tvaAmount || 0,
              q.total || 0,
              translateQuoteStatusFr(q.status),
            ];
          });
          rows.push([
            "TOTAL GÉNÉRAL",
            `${list.length} devis`,
            "",
            "",
            list.reduce((s, q) => s + (q.subtotal || q.taxBase || 0), 0),
            list.reduce((s, q) => s + (q.discount || 0), 0),
            list.reduce((s, q) => s + Math.max(0, (q.subtotal || q.taxBase || 0) - (q.discount || 0)), 0),
            list.reduce((s, q) => s + (q.cssAmount || 0), 0),
            list.reduce((s, q) => s + (q.tpsAmount || 0), 0),
            list.reduce((s, q) => s + (q.tvaAmount || 0), 0),
            list.reduce((s, q) => s + (q.total || 0), 0),
            "",
          ]);
          downloadSafeCsv(
            fileTag,
            [
              "Numéro Devis",
              "Client",
              "Date d'émission",
              "Validité",
              "Brut HT (FCFA)",
              "Remise (FCFA)",
              "Net HT (FCFA)",
              "CSS 1% (FCFA)",
              "TPS 9.5% (FCFA)",
              "TVA 18% (FCFA)",
              "Total TTC (FCFA)",
              "Statut",
            ],
            rows
          );
        } else if (scope === "credit-notes") {
          const list = filteredData as CreditNote[];
          const rows: Array<Array<string | number>> = list.map((cn) => [
            cn.number,
            resolveCreditNoteInvoiceNumber(cn, invoices),
            cn.clientName,
            formatExcelDateFr(cn.date),
            cn.reason || "—",
            cn.subtotal || 0,
            cn.cssAmount || 0,
            cn.tpsAmount || 0,
            cn.tvaAmount || 0,
            cn.total || 0,
            "Remboursé / Déduit",
          ]);
          rows.push([
            "TOTAL GÉNÉRAL",
            `${list.length} avoir(s)`,
            "",
            "",
            "",
            list.reduce((s, cn) => s + (cn.subtotal || 0), 0),
            list.reduce((s, cn) => s + (cn.cssAmount || 0), 0),
            list.reduce((s, cn) => s + (cn.tpsAmount || 0), 0),
            list.reduce((s, cn) => s + (cn.tvaAmount || 0), 0),
            list.reduce((s, cn) => s + (cn.total || 0), 0),
            "",
          ]);
          downloadSafeCsv(
            fileTag,
            [
              "Numéro Avoir",
              "Facture Liée",
              "Client",
              "Date",
              "Motif",
              "Sous-total HT (FCFA)",
              "CSS 1% (FCFA)",
              "TPS 9.5% (FCFA)",
              "TVA 18% (FCFA)",
              "Total Avoir TTC (FCFA)",
              "Statut",
            ],
            rows
          );
        } else if (scope === "services") {
          const rows = (filteredData as Service[]).map((s) => [
            s.name,
            s.trackStock ? ((s as any).stockItemName || s.name) : "Non suivi",
            s.category || "Général",
            s.unit || "Unité",
            s.unitPrice || 0,
            s.trackStock ? (s.stockQuantity || 0) : 0,
            s.description || "—",
          ]);
          downloadSafeCsv(
            fileTag,
            [
              "Désignation commerciale",
              "Article en stock lié",
              "Catégorie",
              "Unité",
              "Prix Unitaire HT (FCFA)",
              "Qté en stock",
              "Description",
            ],
            rows
          );
        } else if (scope === "stock") {
          const list = filteredData as any[];
          const rows: Array<Array<string | number>> = list.map((item) => [
            getPhysicalStockTitle(item),
            item.name,
            item.category || "Prestation",
            Number(item.stockQuantity || 0),
            Number(item.minStockAlert || 0),
            item.unit || "Unité",
            Number(item.unitPrice || 0),
            Number(item.stockQuantity || 0) * Number(item.unitPrice || 0),
          ]);
          rows.push([
            "TOTAL GÉNÉRAL",
            `${list.length} article(s)`,
            "",
            list.reduce((s, i) => s + Number(i.stockQuantity || 0), 0),
            "",
            "",
            "",
            list.reduce((s, i) => s + Number(i.stockQuantity || 0) * Number(i.unitPrice || 0), 0),
          ]);
          downloadSafeCsv(
            fileTag,
            [
              "Article en stock (Nom physique)",
              "Service commercial lié",
              "Catégorie",
              "Quantité en stock",
              "Seuil d'alerte",
              "Unité",
              "Prix Unitaire HT (FCFA)",
              "Valorisation Totale (FCFA)",
            ],
            rows
          );
        } else if (scope === "ledger") {
          const list = filteredData as LedgerEntry[];
          const totalIn = list.reduce((s, e) => s + (e.type === "IN" ? e.amount : 0), 0);
          const totalOut = list.reduce((s, e) => s + (e.type === "OUT" ? e.amount : 0), 0);
          const rows: Array<Array<string | number>> = list.map((e) => [
            formatExcelDateFr(e.date),
            e.type === "IN" ? "Entrée (Recette)" : "Sortie (Dépense)",
            e.category,
            e.description,
            e.counterparty || "—",
            e.paymentMethod,
            e.reference || "—",
            e.type === "IN" ? e.amount : 0,
            e.type === "OUT" ? e.amount : 0,
            e.type === "IN" ? e.amount : -e.amount,
          ]);
          rows.push([
            "TOTAL GÉNÉRAL",
            `${list.length} écriture(s)`,
            "",
            "",
            "",
            "",
            "",
            totalIn,
            totalOut,
            totalIn - totalOut,
          ]);
          downloadSafeCsv(
            fileTag,
            [
              "Date",
              "Nature",
              "Catégorie",
              "Libellé / Motif",
              "Tiers / Bénéficiaire",
              "Mode de règlement",
              "Référence pièce",
              "Entrée (FCFA)",
              "Sortie (FCFA)",
              "Solde Net (FCFA)",
            ],
            rows
          );
        } else if (scope === "audit") {
          const list = filteredData as any[];
          const rows: Array<Array<string | number>> = list.map((log) => [
            formatAuditDateTimeFr(log.createdAt),
            log.userName || "Système",
            formatAuditAction(log.action).label,
            formatAuditEntity(log.entityType),
            formatAuditDetails(log.details).humanText,
          ]);
          downloadSafeCsv(
            fileTag,
            ["Horodatage", "Utilisateur", "Action", "Module / Entité", "Détails de l'opération"],
            rows
          );
        } else {
          const rows = (filteredData as typeof clients).map((c) => [
            c.name,
            c.email || "—",
            c.phone || "—",
            c.address || "—",
            c.nif || "—",
            c.rccm || "—",
          ]);
          downloadSafeCsv(
            fileTag,
            ["Raison Sociale / Nom", "Email", "Téléphone", "Adresse", "NIF", "RCCM"],
            rows
          );
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
  const ledgerStatuses = [
    { id: "all", label: "Tous les flux" },
    { id: "IN", label: "Entrées (Recettes)" },
    { id: "OUT", label: "Sorties (Dépenses)" },
  ];
  const stockStatuses = [
    { id: "all", label: "Tous" },
    { id: "in_stock", label: "En stock" },
    { id: "low_stock", label: "Stock faible" },
    { id: "out_of_stock", label: "Rupture" },
  ];
  const auditStatuses = [
    { id: "all", label: "Toutes les actions" },
    { id: "CREATE", label: "Création" },
    { id: "UPDATE", label: "Modification" },
    { id: "DELETE", label: "Suppression" },
    { id: "SHARE", label: "Partage" },
    { id: "LOGIN", label: "Connexion" },
  ];

  const statusOptions =
    scope === "invoices"
      ? invoiceStatuses
      : scope === "quotes"
      ? quoteStatuses
      : scope === "ledger"
      ? ledgerStatuses
      : scope === "stock"
      ? stockStatuses
      : scope === "audit"
      ? auditStatuses
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] bg-card border-border">
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
          {/* Périmètre DONNÉES */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Données</Label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {[
                { id: "invoices", label: "Factures", count: invoices.filter((i) => !i.deletedAt).length },
                { id: "quotes", label: "Devis", count: quotes.filter((q) => !q.deletedAt).length },
                { id: "credit-notes", label: "Avoirs", count: creditNotes.filter((c) => !c.deletedAt).length },
                { id: "clients", label: "Clients", count: clients.filter((c) => !c.deletedAt).length },
                { id: "services", label: "Services", count: services.filter((s) => !(s as any).deletedAt).length },
                { id: "stock", label: "Gestion de stock", count: effectiveStockCatalog.length },
                { id: "ledger", label: "Livre des comptes", count: ledgerEntries.length },
                { id: "audit", label: "Journal d'audit", count: auditLogs.length },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setScope(item.id as NormalizedExportScope);
                    setStatusFilter("all");
                  }}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    scope === item.id
                      ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                      : "bg-secondary/40 border-border hover:bg-secondary/80 text-foreground"
                  }`}
                >
                  <p className="text-xs truncate">{item.label}</p>
                  <span className="text-[10px] opacity-80 tabular-nums">({item.count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Période */}
          {(scope === "invoices" || scope === "quotes" || scope === "credit-notes" || scope === "ledger" || scope === "audit") && (
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
          )}

          {/* Filtre statut */}
          {statusOptions && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Statut
              </Label>
              <div className="flex flex-wrap gap-1">
                {statusOptions.map((st) => (
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

          {/* Format — harmonisé Design System (border-primary bg-primary/5 text-primary) */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Format</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat("xlsx")}
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-colors ${
                  format === "xlsx"
                    ? "border-primary bg-primary/5 text-primary font-semibold"
                    : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
                <div className="text-left text-xs">
                  <p className="font-bold">Excel stylisé (.xlsx)</p>
                  <p className="text-[10px] opacity-80">En-tête, bordures, colonnes auto &amp; totaux</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-colors ${
                  format === "csv"
                    ? "border-primary bg-primary/5 text-primary font-semibold"
                    : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60"
                }`}
              >
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <div className="text-left text-xs">
                  <p className="font-bold">CSV (.csv)</p>
                  <p className="text-[10px] opacity-80">UTF-8 BOM · Format tableur OHADA</p>
                </div>
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

export { DataExportModal as ExportCenterModal };
