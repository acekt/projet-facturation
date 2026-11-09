"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  FileText,
  MoreVertical,
  Download,
  Trash2,
  CheckCircle2,
  Edit2,
  Eye,
  Info,
  Calendar,
  Send,
  CreditCard,
  RotateCcw,
  Ban,
} from "lucide-react";
import { ShareDocumentModal } from "@/components/features/share/ShareDocumentModal";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  onViewDetails: (invoice: Invoice) => void;
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
  return name.replace(/(?:^|[\s'-])\p{L}/gu, (char) => char.toUpperCase());
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
  const statusStr = String(invoice.status || "").toLowerCase();
  const isCancelled =
    invoice.status === INVOICE_STATUS.CANCELLED ||
    statusStr === "cancelled" ||
    statusStr === "annulee" ||
    statusStr === "annulée";

  const ps = getPaymentStatus(invoice, creditNotes);

  if (isCancelled || ps.settledByCreditNote) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Annulée (Avoir)
      </span>
    );
  }

  if (ps.status === "paid") {
    return <StatusBadge variant="invoice-paid" amount={ps.paid + ps.credited} />;
  }
  if (ps.status === "partial") {
    return <StatusBadge variant="invoice-partial" paidAmount={ps.paid + ps.credited} remainingAmount={ps.remaining} />;
  }
  return <StatusBadge variant="invoice-unpaid" remainingAmount={ps.remaining} />;
}

export function isInvoiceProtected(inv: Invoice, creditNotes?: CreditNote[]): boolean {
  const totalPaid = inv.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalCredited =
    creditNotes?.filter((cn) => cn.invoiceId === inv.id && !cn.deletedAt).reduce((sum, cn) => sum + cn.total, 0) || 0;
  return totalPaid > 0 || totalCredited > 0 || inv.status === "PAID" || inv.status === "PARTIALLY_PAID";
}

// custom progress
const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={`w-full bg-secondary overflow-hidden rounded-full ${className}`}>
    <div className="h-full bg-primary transition-all" style={{ width: `${value}%` }} />
  </div>
);

export function InvoiceViews({
  invoices,
  creditNotes,
  viewFormat,
  user,
  searchQuery,
  isDownloading,
  onViewDetails,
  onPreview,
  onDownloadPDF,
  onEdit,
  onRecordPayment,
  onEmitCreditNote,
  onCancel,
  onDelete,
  onCreateInvoice,
}: InvoiceViewsProps) {
  const [sharingInvoice, setSharingInvoice] = React.useState<Invoice | null>(null);
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
    const isDraft = invoice.status === "draft" || (invoice.status as string) === "BROUILLON" || (invoice.status as string) === "DRAFT";
    const isCancelled = invoice.status === INVOICE_STATUS.CANCELLED || (invoice.status as string) === "ANNULEE" || (invoice.status as string) === "cancelled";

    const canEditDraft = canModify(invoice) && isDraft && !isCancelled;
    const canPay = invoice.status !== "PAID" && !isCancelled && !isDraft && canModify(invoice);
    const canCredit = canModify(invoice) && !isCancelled && !isDraft && Boolean(onEmitCreditNote);
    const hasBusinessActions = canEditDraft || canPay || canCredit;

    const totalPaid = Array.isArray(invoice.payments) ? invoice.payments.reduce((sum, p) => sum + (p.amount || 0), 0) : 0;
    const canCancelInvoice = canModify(invoice) && !isCancelled && !isDraft && totalPaid === 0 && !isProtected;
    const canDeleteInvoice = canModify(invoice) && isDraft;
    const hasRiskActions = canCancelInvoice || canDeleteInvoice;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer">
            <MoreVertical className="w-4 h-4" />
            <span className="sr-only">Actions de la facture</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-card border-border shadow-lg p-1.5 rounded-xl">
          {/* Groupe 1 : Consultation & Diffusion */}
          <DropdownMenuItem className="gap-2.5 cursor-pointer font-medium" onClick={() => setTimeout(() => onViewDetails(invoice), 0)}>
            <Info className="w-4 h-4 text-primary" /> Voir les détails
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => setTimeout(() => onPreview(invoice), 0)}>
            <Eye className="w-4 h-4 text-muted-foreground" /> Aperçu du document (A4)
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2.5 cursor-pointer"
            onClick={() => setTimeout(() => { onDownloadPDF(invoice) }, 0)}
            disabled={isDownloading === invoice.id}
          >
            <Download className="w-4 h-4 text-muted-foreground" />
            {isDownloading === invoice.id ? "Génération..." : "Télécharger PDF"}
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => setTimeout(() => setSharingInvoice(invoice), 0)}>
            <Send className="w-4 h-4 text-primary" /> Partager (WhatsApp / Email)
          </DropdownMenuItem>

          {/* Groupe 2 : Gestion Métier & Règlements */}
          {hasBusinessActions && (
            <>
              <DropdownMenuSeparator className="my-1 bg-border/60" />
              {canEditDraft && (
                <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => setTimeout(() => { onEdit(invoice.id) }, 0)}>
                  <Edit2 className="w-4 h-4 text-muted-foreground" /> Modifier la facture
                </DropdownMenuItem>
              )}
              {canPay && (
                <DropdownMenuItem className="gap-2.5 cursor-pointer font-medium" onClick={() => setTimeout(() => onRecordPayment(invoice), 0)}>
                  <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Enregistrer un règlement
                </DropdownMenuItem>
              )}
              {canCredit && onEmitCreditNote && (
                <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => setTimeout(() => onEmitCreditNote(invoice), 0)}>
                  <RotateCcw className="w-4 h-4 text-muted-foreground" /> Émettre un avoir
                </DropdownMenuItem>
              )}
            </>
          )}

          {/* Groupe 3 : Actions Sensibles & Destructives */}
          {hasRiskActions && (
            <>
              <DropdownMenuSeparator className="my-1 bg-border/60" />
              {canCancelInvoice && (
                <DropdownMenuItem
                  className="gap-2.5 cursor-pointer text-amber-700 dark:text-amber-400 focus:text-amber-700 dark:focus:text-amber-300"
                  onClick={() => setTimeout(() => onCancel(invoice), 0)}
                >
                  <Ban className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Annuler la facture
                </DropdownMenuItem>
              )}
              {canDeleteInvoice && (
                <DropdownMenuItem
                  className="gap-2.5 cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => setTimeout(() => onDelete(invoice.id), 0)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" /> Supprimer
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // ── 1. VUE TABLEAU ──────────────────────────────────────────────────────────
  if (!viewFormat || viewFormat === "table") {
    return (
      <>
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
      {sharingInvoice && (
        <ShareDocumentModal
          open={!!sharingInvoice}
          onOpenChange={(open) => !open && setSharingInvoice(null)}
          document={sharingInvoice}
          type="invoice"
        />
      )}
      </>
    );
  }

  // ── 2. VUE HORIZONTALE ──────────────────────────────────────────────────────
  if (viewFormat === "horizontal") {
    return (
      <>
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 pr-1 pb-6">
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
      {sharingInvoice && (
        <ShareDocumentModal
          open={!!sharingInvoice}
          onOpenChange={(open) => !open && setSharingInvoice(null)}
          document={sharingInvoice}
          type="invoice"
        />
      )}
      </>
    );
  }

  // ── 3. VUE BLOC / CARTES ───────────────────────────────────────────────────
  return (
    <>
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 pr-1 pb-6">
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
                <div className="bg-secondary/30 px-4 py-2 border-t border-border/50 flex items-center justify-between gap-2">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold min-w-0 truncate">Total TTC</div>
                  <div className="font-bold text-foreground text-sm tabular-nums shrink-0 whitespace-nowrap">{formatCurrency(invoice.total)}</div>
                </div>
                {invoice.payments && invoice.payments.length > 0 && (
                  <div className="px-4 pb-3 bg-secondary/30">
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground mb-1">
                      <span>Progression</span>
                      <span className="font-bold">{Math.round(((invoice.payments.reduce((s,p)=>s+p.amount,0) + (creditNotes?.filter(c=>c.invoiceId === invoice.id && !c.deletedAt).reduce((s,c)=>s+c.total,0)||0)) / invoice.total) * 100)}%</span>
                    </div>
                    <Progress value={Math.round(((invoice.payments.reduce((s,p)=>s+p.amount,0) + (creditNotes?.filter(c=>c.invoiceId === invoice.id && !c.deletedAt).reduce((s,c)=>s+c.total,0)||0)) / invoice.total) * 100)} className="h-1" />
                  </div>
                )}
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
    {sharingInvoice && (
      <ShareDocumentModal
        open={!!sharingInvoice}
        onOpenChange={(open) => !open && setSharingInvoice(null)}
        document={sharingInvoice}
        type="invoice"
      />
    )}
    </>
  );
}
