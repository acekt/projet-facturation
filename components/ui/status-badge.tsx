import { QUOTE_STATUS, INVOICE_STATUS } from "@/lib/constants";
/**
 * StatusBadge — Dictionnaire centralisé de tous les statuts
 * ===========================================================
 * Remplace les fonctions getStatusBadge() et getPaymentBadge() inline dans chaque page.
 *
 * Utilisation :
 *   // Statut de paiement d'une facture (avec montants)
 *   <StatusBadge variant="invoice-paid" amount={385500} />
 *   <StatusBadge variant="invoice-partial" paidAmount={180000} remainingAmount={205500} />
 *   <StatusBadge variant="invoice-unpaid" remainingAmount={385500} />
 *
 *   // Statut d'un devis
 *   <StatusBadge variant="quote-pending" />
 *   <StatusBadge variant="quote-converted" />
 *   <StatusBadge variant="quote-sent" />
 *   <StatusBadge variant="quote-refused" />
 *   <StatusBadge variant="quote-expired" />
 *
 *   // Statut générique
 *   <StatusBadge variant="active" />
 *   <StatusBadge variant="inactive" />
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

// ── Dictionnaire de variantes ──────────────────────────────────────────────────
const VARIANT_MAP = {
  // Factures — statuts de paiement
  "invoice-paid": {
    base: "bg-emerald-50 text-emerald-700 border-emerald-200",
    label: "Soldé",
  },
  "invoice-partial": {
    base: "bg-amber-50 text-amber-700 border-amber-200",
    label: "Partiel",
  },
  "invoice-unpaid": {
    base: "bg-red-50 text-red-700 border-red-200",
    label: "Non payé",
  },
  // Devis — statuts de cycle de vie
  "quote-pending": {
    base: "bg-amber-100 text-amber-700 border-amber-200",
    label: "En Attente",
  },
  "quote-converted": {
    base: "bg-green-100 text-green-700 border-green-200",
    label: "Converti",
  },
  "quote-sent": {
    base: "bg-blue-50 text-blue-700 border-blue-200",
    label: "Envoyé",
  },
  "quote-refused": {
    base: "bg-red-50 text-red-700 border-red-200",
    label: "Refusé",
  },
  "quote-expired": {
    base: "bg-zinc-100 text-zinc-600 border-zinc-200",
    label: "Expiré",
  },
  // Génériques
  active: {
    base: "bg-emerald-50 text-emerald-700 border-emerald-200",
    label: "Actif",
  },
  inactive: {
    base: "bg-zinc-100 text-zinc-600 border-zinc-200",
    label: "Inactif",
  },
  neutral: {
    base: "bg-zinc-100 text-zinc-600 border-zinc-200",
    label: "",
  },
} as const;

export type StatusBadgeVariant = keyof typeof VARIANT_MAP;

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  /** Montant total pour invoice-paid */
  amount?: number;
  /** Montant payé pour invoice-partial */
  paidAmount?: number;
  /** Montant restant pour invoice-partial ou invoice-unpaid */
  remainingAmount?: number;
  /** Étiquette personnalisée (ex : catégorie de service) */
  label?: string;
  className?: string;
}

export function StatusBadge({
  variant,
  amount,
  paidAmount,
  remainingAmount,
  label,
  className,
}: StatusBadgeProps) {
  const config = VARIANT_MAP[variant];

  // Construction du libellé selon le variant
  let text: React.ReactNode = label ?? config.label;

  if (variant === "invoice-paid" && amount !== undefined) {
    text = `Soldé (${formatCurrency(amount)})`;
  } else if (
    variant === "invoice-partial" &&
    paidAmount !== undefined &&
    remainingAmount !== undefined
  ) {
    text = `Partiel — Payé: ${formatCurrency(paidAmount)} | Reste: ${formatCurrency(remainingAmount)}`;
  } else if (variant === "invoice-unpaid" && remainingAmount !== undefined) {
    text = `Non payé — Reste: ${formatCurrency(remainingAmount)}`;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-2 py-0.5",
        "text-xs font-medium whitespace-nowrap shrink-0 transition-colors",
        config.base,
        className,
      )}
    >
      {text}
    </span>
  );
}

// ── Helper : convertit un statut Invoice en variante StatusBadge ───────────────
type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];
interface InvoicePaymentInfo {
  status: InvoiceStatus;
  paidAmount: number;
  remainingAmount: number;
  total: number;
}

export function getInvoiceStatusVariant(
  info: InvoicePaymentInfo,
): StatusBadgeVariant {
  const { paidAmount, total } = info;
  if (paidAmount >= total && total > 0) return "invoice-paid";
  if (paidAmount > 0) return "invoice-partial";
  return "invoice-unpaid";
}

// ── Helper : convertit un statut Quote en variante StatusBadge ────────────────
type QuoteStatus = (typeof QUOTE_STATUS)[keyof typeof QUOTE_STATUS];

export function getQuoteStatusVariant(status: QuoteStatus): StatusBadgeVariant {
  switch (status) {
    case QUOTE_STATUS.CONVERTI:
      return "quote-converted";
    case QUOTE_STATUS.ENVOYE:
      return "quote-sent";
    case QUOTE_STATUS.REFUSE:
      return "quote-refused";
    case QUOTE_STATUS.EXPIRE:
    case QUOTE_STATUS.EXPIRED:
      return "quote-expired";
    case QUOTE_STATUS.EN_ATTENTE:
    default:
      return "quote-pending";
  }
}
