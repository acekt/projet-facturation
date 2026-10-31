"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  FileText,
  MoreVertical,
  Download,
  Printer,
  Trash2,
  CheckCircle2,
  Edit2,
  Eye,
  RefreshCcw,
  Calendar,
} from "lucide-react";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { EmptyState } from "@workspace/ui/components/empty-state";
import {
  DataTable,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableHeaderCell,
  DataTableCell,
  AmountCell,
  ActionsCell,
} from "@workspace/ui/components/data-table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { INVOICE_STATUS } from "@/lib/constants";
import type { Invoice, User, CreditNote } from "@/lib/store";

interface InvoiceViewsProps {
  invoices: Invoice[];
  creditNotes?: CreditNote[];
  viewFormat: "table" | "horizontal" | "block";
  user: User | null;
  searchQuery: string;
  isDownloading: string | null;
  onPreview: (invoice: Invoice) => void;
  onDownloadPDF: (invoice: Invoice) => void;
  onEdit: (id: string) => void;
  onRecordPayment: (invoice: Invoice) => void;
  onEmitCreditNote?: (invoice: Invoice) => void;
  onCancel: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  onCreateInvoice: () => void;
}

export function formatClientName(name: string) {
  if (!name) return "—";
  if (name.length <= 6 && !name.includes(" ")) {
    return name.toUpperCase();
  }
  return name.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getPaymentStatus(invoice: Invoice, creditNotes?: CreditNote[]) {
  const totalPaid = invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalCredited =
    creditNotes?.filter((cn) => cn.invoiceId === invoice.id && !cn.deletedAt).reduce((sum, cn) => sum + cn.total, 0) || 0;
  const remaining = Math.max(0, invoice.total - totalPaid - totalCredited);
  if (remaining === 0) {
    return {
      status: "paid" as const,
      paid: totalPaid,
      credited: totalCredited,
      remaining: 0,
      settledByCreditNote: totalCredited > 0 && totalPaid === 0,
    };
  }
  if (totalPaid === 0 && totalCredited === 0) {
    return { status: "unpaid" as const, paid: 0, credited: 0, remaining: invoice.total, settledByCreditNote: false };
  }
  return { status: "partial" as const, paid: totalPaid, credited: totalCredited, remaining, settledByCreditNote: false };
}

export function getPaymentBadge(invoice: Invoice, creditNotes?: CreditNote[]) {
  const ps = getPaymentStatus(invoice, creditNotes);
  if (ps.status === "paid") {
    if (ps.settledByCreditNote) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Soldé (Avoir)
        </span>
      );
    }
    return <StatusBadge variant="invoice-paid" amount={ps.paid + ps.credited} />;
  }
  if (ps.status === "partial") {
    return <StatusBadge variant="invoice-partial" paidAmount={ps.paid + ps.credited} remainingAmount={ps.remaining} />;
  }
  return <StatusBadge variant="invoice-unpaid" remainingAmount={ps.remaining} />;
}

export function isInvoiceProtected(inv: Invoice, creditNotes?: CreditNote[]) {
  const totalPaid = inv.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalCredited =
    creditNotes?.filter((cn) => cn.invoiceId === inv.id && !cn.deletedAt).reduce((sum, cn) => sum + cn.total, 0) || 0;
  return totalPaid > 0 || totalCredited > 0 || inv.status === "PAID" || inv.status === "PARTIALLY_PAID";
}

export function InvoiceViews({
  invoices,
  creditNotes,
  viewFormat,
  user,
  searchQuery,
  isDownloading,
  onPreview,
  onDownloadPDF,
  onEdit,
  onRecordPayment,
  onEmitCreditNote,
  onCancel,
  onDelete,
  onCreateInvoice,
}: InvoiceViewsProps) {
  const isOperatorOrAdmin = user?.role === "user" || user?.role === "admin";
  const isAdmin = user?.role === "admin";
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [invoices]);

  const canModify = (inv: Invoice) =>
    isOperatorOrAdmin && (inv.created_by === user?.id || isAdmin);

  const renderActionsMenu = (invoice: Invoice) => {
    const isProtected = isInvoiceProtected(invoice, creditNotes);
    const isDraft = invoice.status === "draft" || (invoice.status as string) === "BROUILLON";

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 bg-card border-border">
          <DropdownMenuItem className="gap-2" onClick={() => onPreview(invoice)}>
            <Eye className="w-4 h-4" /> Aperçu
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onClick={() => onPreview(invoice)}>
            <Printer className="w-4 h-4" /> Imprimer
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => onDownloadPDF(invoice)}
            disabled={isDownloading === invoice.id}
          >
            <Download className="w-4 h-4" /> {isDownloading === invoice.id ? "Génération..." : "Télécharger PDF"}
          </DropdownMenuItem>
          {canModify(invoice) && isDraft && (
            <DropdownMenuItem className="gap-2" onClick={() => onEdit(invoice.id)}>
              <Edit2 className="w-4 h-4" /> Modifier
            </DropdownMenuItem>
          )}
          {invoice.status !== "PAID" && invoice.status !== INVOICE_STATUS.CANCELLED && canModify(invoice) && (
            <DropdownMenuItem className="gap-2 text-accent" onClick={() => onRecordPayment(invoice)}>
              <CheckCircle2 className="w-4 h-4" /> Enregistrer un règlement
            </DropdownMenuItem>
          )}
          {canModify(invoice) && invoice.status !== INVOICE_STATUS.CANCELLED && onEmitCreditNote && (
            <DropdownMenuItem className="gap-2 text-orange-600" onClick={() => onEmitCreditNote(invoice)}>
              <RefreshCcw className="w-4 h-4" /> Émettre un avoir / remboursement
            </DropdownMenuItem>
          )}
          {canModify(invoice) && invoice.status !== INVOICE_STATUS.CANCELLED && !isProtected && (
            <DropdownMenuItem className="gap-2 text-orange-600" onClick={() => onCancel(invoice)}>
              <RefreshCcw className="w-4 h-4" /> Annuler
            </DropdownMenuItem>
          )}
          {canModify(invoice) && !isProtected && (
            <>
              <div className="h-px bg-border my-1" />
              <DropdownMenuItem className="gap-2 text-destructive" onClick={() => onDelete(invoice.id)}>
                <Trash2 className="w-4 h-4" /> Supprimer
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // ── 1. VUE TABLEAU ──────────────────────────────────────────────────────────
  if (!viewFormat || viewFormat === "table") {
    return (
      <DataTable>
        <DataTableHead>
          <DataTableRow>
            <DataTableHeaderCell>Facture</DataTableHeaderCell>
            <DataTableHeaderCell className="w-[320px] min-w-[240px]">Client</DataTableHeaderCell>
            <DataTableHeaderCell>Date</DataTableHeaderCell>
            <DataTableHeaderCell>Statut</DataTableHeaderCell>
            <DataTableHeaderCell align="right">Total</DataTableHeaderCell>
            <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {invoices.map((invoice) => (
            <DataTableRow key={invoice.id}>
              <DataTableCell>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-primary/5 flex items-center justify-center text-primary flex-shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="font-mono font-medium text-sm text-foreground">{invoice.number}</span>
                </div>
              </DataTableCell>
              <DataTableCell className="w-[320px] min-w-[240px]">
                <div className="font-medium text-foreground truncate max-w-[320px]" title={invoice.clientName}>
                  {formatClientName(invoice.clientName)}
                </div>
              </DataTableCell>
              <DataTableCell>
                <span className="text-xs text-muted-foreground tabular-nums">{formatDate(invoice.date)}</span>
              </DataTableCell>
              <DataTableCell>{getPaymentBadge(invoice, creditNotes)}</DataTableCell>
              <AmountCell amount={invoice.total} />
              <ActionsCell>{renderActionsMenu(invoice)}</ActionsCell>
            </DataTableRow>
          ))}
          {invoices.length === 0 && (
            <DataTableRow>
              <DataTableCell colSpan={6} className="py-8 text-center">
                <EmptyState
                  icon={FileText}
                  title={searchQuery ? "Aucun résultat" : "Aucune facture"}
                  description={
                    searchQuery
                      ? "Aucune facture ne correspond aux critères de recherche saisis."
                      : "Aucune facture enregistrée dans cette vue. Vous pouvez créer une facture directement ou convertir un devis validé."
                  }
                  actionLabel={!searchQuery && isOperatorOrAdmin ? "Nouvelle Facture" : undefined}
                  onAction={!searchQuery && isOperatorOrAdmin ? onCreateInvoice : undefined}
                />
              </DataTableCell>
            </DataTableRow>
          )}
        </DataTableBody>
      </DataTable>
    );
  }

  // ── 2. VUE HORIZONTALE ──────────────────────────────────────────────────────
  if (viewFormat === "horizontal") {
    return (
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 pr-1">
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <Card key={invoice.id} className="bg-card border-border hover:border-primary/30 transition-all group shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-mono font-bold text-sm">{invoice.number}</h3>
                        <span className="text-xs text-muted-foreground">• {formatClientName(invoice.clientName)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground tabular-nums">{formatDate(invoice.date)}</span>
                        <span>•</span>
                        <span className="font-semibold text-xs text-foreground tabular-nums">{formatCurrency(invoice.total)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getPaymentBadge(invoice, creditNotes)}
                    {renderActionsMenu(invoice)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {invoices.length === 0 && (
            <EmptyState
              icon={FileText}
              title={searchQuery ? "Aucun résultat" : "Aucune facture"}
              description={
                searchQuery
                  ? "Aucune facture ne correspond à votre recherche."
                  : "Les factures sont générées automatiquement après la conversion d'un devis accepté."
              }
              actionLabel={!searchQuery && isOperatorOrAdmin ? "Nouvelle Facture" : undefined}
              onAction={!searchQuery && isOperatorOrAdmin ? onCreateInvoice : undefined}
            />
          )}
        </div>
      </div>
    );
  }

  // ── 3. VUE BLOC / CARTES ───────────────────────────────────────────────────
  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 pr-1">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {invoices.map((invoice, index) => (
          <motion.div
            key={invoice.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="bg-card border-border hover:border-primary/30 transition-all group overflow-hidden shadow-sm">
              <CardContent className="p-0">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      {getPaymentBadge(invoice, creditNotes)}
                      {renderActionsMenu(invoice)}
                    </div>
                  </div>
                  <h3 className="font-mono font-semibold text-foreground text-sm mb-1">{invoice.number}</h3>
                  <p className="text-xs text-muted-foreground mb-3 font-medium">{formatClientName(invoice.clientName)}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5 text-primary/40" />
                    <span className="tabular-nums">{formatDate(invoice.date)}</span>
                  </div>
                </div>
                <div className="bg-secondary/30 px-4 py-2 border-t border-border/50 flex items-center justify-between">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Total TTC</div>
                  <div className="font-semibold text-foreground text-sm tracking-tighter tabular-nums">{formatCurrency(invoice.total)}</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {invoices.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon={FileText}
              title={searchQuery ? "Aucun résultat" : "Aucune facture"}
              description={
                searchQuery
                  ? "Aucune facture ne correspond à votre recherche."
                  : "Les factures sont générées automatiquement après la conversion d'un devis accepté."
              }
              actionLabel={!searchQuery && isOperatorOrAdmin ? "Nouvelle Facture" : undefined}
              onAction={!searchQuery && isOperatorOrAdmin ? onCreateInvoice : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
