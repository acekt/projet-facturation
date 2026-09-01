/**
 * ExportService.ts
 * ════════════════════════════════════════════════════════════════
 * Service d'export Excel (.xlsx) premium — charte Global Maintenance
 * Couleurs : Bleu #003399 | Vert #2CA02C
 * ════════════════════════════════════════════════════════════════
 */

import ExcelJS from "exceljs";
import type { Invoice, Quote, Payment } from "@/lib/store";

// ── Helpers ────────────────────────────────────────────────────────────────────

const BLUE = "003399";
const WHITE = "FFFFFF";
const LIGHT_BLUE = "E8EDF8";
const GREEN = "2CA02C";
const LIGHT_GREEN = "EAF6EA";

type FillPattern = ExcelJS.Fill & { type: "pattern" };

function solidFill(argb: string): FillPattern {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function translateInvoiceStatus(status: string): string {
  const map: Record<string, string> = {
    PAID: "Payé",
    UNPAID: "Non payé",
    PARTIALLY_PAID: "Partiel",
    overdue: "En retard",
    OVERDUE: "En retard",
    cancelled: "Annulé",
    CANCELLED: "Annulé",
    draft: "Brouillon",
    pending: "En attente",
  };
  return map[status] ?? status;
}

function translateQuoteStatus(status: string): string {
  const map: Record<string, string> = {
    EN_ATTENTE: "En attente",
    CONVERTI: "Converti",
    ENVOYE: "Envoyé",
    REFUSE: "Refusé",
    EXPIRE: "Expiré",
    EXPIRED: "Expiré",
  };
  return map[status] ?? status;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    const [year, month, day] = dateStr.trim().split('-');
    return `${day}/${month}/${year}`;
  }
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function applyHeaderRowStyle(row: ExcelJS.Row) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.fill = solidFill(BLUE);
    cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: WHITE } },
      bottom: { style: "thin", color: { argb: WHITE } },
      left: { style: "thin", color: { argb: WHITE } },
      right: { style: "thin", color: { argb: WHITE } },
    };
  });
}

function applyDataRowStyle(row: ExcelJS.Row, isEven: boolean) {
  row.height = 18;
  row.eachCell((cell) => {
    cell.fill = solidFill(isEven ? LIGHT_BLUE : WHITE);
    cell.alignment = { vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "DDDDDD" } },
    };
  });
}

async function triggerDownload(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Export Factures ────────────────────────────────────────────────────────────

export async function exportInvoicesToExcel(invoices: Invoice[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Global Maintenance";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Factures", {
    pageSetup: { orientation: "landscape", fitToPage: true },
  });

  // ── Largeurs des colonnes ──────────────────────────────────────
  ws.columns = [
    { key: "number",     width: 24 },
    { key: "client",     width: 32 },
    { key: "date",       width: 14 },
    { key: "dueDate",    width: 16 },
    { key: "subject",    width: 36 },
    { key: "total",      width: 18 },
    { key: "status",     width: 16 },
  ];

  // ── Lignes 1-3 : En-tête du document ──────────────────────────
  const dateExport = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  // Ligne 1 : Titre
  ws.mergeCells("A1:G1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "GLOBAL MAINTENANCE — Rapport des Factures";
  titleCell.font = { bold: true, size: 16, color: { argb: BLUE } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  // Ligne 2 : Date d'export
  ws.mergeCells("A2:G2");
  const dateCell = ws.getCell("A2");
  dateCell.value = `Exporté le ${dateExport}`;
  dateCell.font = { italic: true, size: 10, color: { argb: "666666" } };
  dateCell.alignment = { horizontal: "center" };
  ws.getRow(2).height = 18;

  // Ligne 3 : vide (espacement)
  ws.getRow(3).height = 8;

  // ── Ligne 4 : Statistiques rapides ────────────────────────────
  const totalPaid = invoices.filter(i => i.status === "PAID").length;
  const totalUnpaid = invoices.filter(i => i.status === "UNPAID").length;
  ws.mergeCells("A4:G4");
  const statsCell = ws.getCell("A4");
  statsCell.value = `Total : ${invoices.length} factures  ·  Payées : ${totalPaid}  ·  Non payées : ${totalUnpaid}`;
  statsCell.font = { size: 9, color: { argb: "444444" } };
  statsCell.alignment = { horizontal: "center" };
  ws.getRow(4).height = 16;

  // ── Ligne 5 : En-têtes du tableau ─────────────────────────────
  const headerRow = ws.addRow([
    "Numéro de Facture",
    "Client",
    "Date d'émission",
    "Date d'échéance",
    "Objet",
    "Total (FCFA)",
    "Statut",
  ]);
  applyHeaderRowStyle(headerRow);

  // ── Lignes 6+ : Données ───────────────────────────────────────
  invoices.forEach((inv, idx) => {
    const row = ws.addRow([
      inv.number,
      inv.clientName,
      formatDate(inv.date),
      inv.dueDate ? formatDate(inv.dueDate) : "—",
      inv.subject ?? "—",
      inv.total,
      translateInvoiceStatus(inv.status),
    ]);
    applyDataRowStyle(row, idx % 2 === 0);

    // Formatage numérique de la colonne Total
    row.getCell(6).numFmt = '#,##0 "FCFA"';
    row.getCell(6).alignment = { horizontal: "right", vertical: "middle" };

    // Coloration conditionnelle du statut
    const statusCell = row.getCell(7);
    statusCell.alignment = { horizontal: "center", vertical: "middle" };
    const s = inv.status as string;
    if (s === "PAID") {
      statusCell.font = { color: { argb: GREEN }, bold: true };
    } else if (s === "UNPAID" || s === "OVERDUE" || s === "overdue") {
      statusCell.font = { color: { argb: "CC0000" }, bold: true };
    }
  });

  // ── Pied de page discret ──────────────────────────────────────
  const footerRowIdx = 6 + invoices.length;
  ws.mergeCells(`A${footerRowIdx}:G${footerRowIdx}`);
  const footerCell = ws.getCell(`A${footerRowIdx}`);
  footerCell.value = "Document généré automatiquement par le logiciel de gestion Global Maintenance";
  footerCell.font = { italic: true, size: 8, color: { argb: "AAAAAA" } };
  footerCell.alignment = { horizontal: "center" };

  // ── Téléchargement ────────────────────────────────────────────
  const dateStr = new Date().toISOString().split("T")[0];
  await triggerDownload(workbook, `Factures_Global_Maintenance_${dateStr}.xlsx`);
}

// ── Export Devis ───────────────────────────────────────────────────────────────

export async function exportQuotesToExcel(quotes: Quote[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Global Maintenance";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Devis", {
    pageSetup: { orientation: "landscape", fitToPage: true },
  });

  ws.columns = [
    { key: "number",     width: 24 },
    { key: "client",     width: 32 },
    { key: "date",       width: 14 },
    { key: "validUntil", width: 18 },
    { key: "subject",    width: 36 },
    { key: "total",      width: 18 },
    { key: "status",     width: 16 },
  ];

  const dateExport = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  // Ligne 1 : Titre
  ws.mergeCells("A1:G1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "GLOBAL MAINTENANCE — Rapport des Devis";
  titleCell.font = { bold: true, size: 16, color: { argb: BLUE } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  // Ligne 2 : Date
  ws.mergeCells("A2:G2");
  const dateCell = ws.getCell("A2");
  dateCell.value = `Exporté le ${dateExport}`;
  dateCell.font = { italic: true, size: 10, color: { argb: "666666" } };
  dateCell.alignment = { horizontal: "center" };
  ws.getRow(2).height = 18;

  ws.getRow(3).height = 8;

  // Ligne 4 : Statistiques
  const totalConverti = quotes.filter(q => q.status === "CONVERTI").length;
  const totalExpire = quotes.filter(q => q.status === "EXPIRED" || q.status === "EXPIRE").length;
  ws.mergeCells("A4:G4");
  const statsCell = ws.getCell("A4");
  statsCell.value = `Total : ${quotes.length} devis  ·  Convertis : ${totalConverti}  ·  Expirés : ${totalExpire}`;
  statsCell.font = { size: 9, color: { argb: "444444" } };
  statsCell.alignment = { horizontal: "center" };
  ws.getRow(4).height = 16;

  // Ligne 5 : En-têtes
  const headerRow = ws.addRow([
    "Numéro de Devis",
    "Client",
    "Date d'émission",
    "Date de validité",
    "Objet",
    "Total (FCFA)",
    "Statut",
  ]);
  applyHeaderRowStyle(headerRow);

  // Données
  quotes.forEach((q, idx) => {
    const row = ws.addRow([
      q.number,
      q.clientName,
      formatDate(q.date),
      (q as any).validUntil ? formatDate((q as any).validUntil) : "—",
      (q as any).subject ?? "—",
      q.total,
      translateQuoteStatus(q.status),
    ]);
    applyDataRowStyle(row, idx % 2 === 0);

    row.getCell(6).numFmt = '#,##0 "FCFA"';
    row.getCell(6).alignment = { horizontal: "right", vertical: "middle" };

    const statusCell = row.getCell(7);
    statusCell.alignment = { horizontal: "center", vertical: "middle" };
    if (q.status === "CONVERTI") {
      statusCell.font = { color: { argb: GREEN }, bold: true };
    } else if (q.status === "EXPIRED" || q.status === "EXPIRE") {
      statusCell.font = { color: { argb: "888888" }, bold: true };
    }
  });

  const footerRowIdx = 6 + quotes.length;
  ws.mergeCells(`A${footerRowIdx}:G${footerRowIdx}`);
  const footerCell = ws.getCell(`A${footerRowIdx}`);
  footerCell.value = "Document généré automatiquement par le logiciel de gestion Global Maintenance";
  footerCell.font = { italic: true, size: 8, color: { argb: "AAAAAA" } };
  footerCell.alignment = { horizontal: "center" };

  const dateStr = new Date().toISOString().split("T")[0];
  await triggerDownload(workbook, `Devis_Global_Maintenance_${dateStr}.xlsx`);
}

// ── Export Paiements ───────────────────────────────────────────────────────────

export async function exportPaymentsToExcel(payments: Payment[], invoices: Invoice[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Global Maintenance";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Paiements", {
    pageSetup: { orientation: "landscape", fitToPage: true },
  });

  ws.columns = [
    { key: "id",          width: 24 },
    { key: "invoice",     width: 24 },
    { key: "amount",      width: 18 },
    { key: "method",      width: 18 },
    { key: "date",        width: 14 },
    { key: "reference",   width: 24 },
  ];

  const dateExport = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  // Ligne 1 : Titre
  ws.mergeCells("A1:F1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "GLOBAL MAINTENANCE — Rapport des Paiements";
  titleCell.font = { bold: true, size: 16, color: { argb: "003399" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  // Ligne 2 : Date
  ws.mergeCells("A2:F2");
  const dateCell = ws.getCell("A2");
  dateCell.value = `Exporté le ${dateExport}`;
  dateCell.font = { italic: true, size: 10, color: { argb: "666666" } };
  dateCell.alignment = { horizontal: "center" };
  ws.getRow(2).height = 18;

  ws.getRow(3).height = 8;

  // Ligne 4 : Statistiques
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  ws.mergeCells("A4:F4");
  const statsCell = ws.getCell("A4");
  statsCell.value = `Total : ${payments.length} paiements  ·  Montant encaissé : ${new Intl.NumberFormat('fr-FR').format(totalAmount)} FCFA`;
  statsCell.font = { size: 9, color: { argb: "444444" } };
  statsCell.alignment = { horizontal: "center" };
  ws.getRow(4).height = 16;

  // Ligne 5 : En-têtes
  const headerRow = ws.addRow([
    "ID Paiement",
    "Numéro de Facture",
    "Montant (FCFA)",
    "Méthode",
    "Date d'encaissement",
    "Référence",
  ]);
  applyHeaderRowStyle(headerRow);

  // Données
  payments.forEach((p, idx) => {
    const inv = invoices.find(i => i.id === p.invoiceId);
    const row = ws.addRow([
      p.id,
      inv?.number || p.invoiceId,
      p.amount,
      p.paymentMethod.toUpperCase(),
      formatDate(p.date),
      p.reference || "—",
    ]);
    applyDataRowStyle(row, idx % 2 === 0);

    row.getCell(3).numFmt = '#,##0 "FCFA"';
    row.getCell(3).alignment = { horizontal: "right", vertical: "middle" };
  });

  const footerRowIdx = 6 + payments.length;
  ws.mergeCells(`A${footerRowIdx}:F${footerRowIdx}`);
  const footerCell = ws.getCell(`A${footerRowIdx}`);
  footerCell.value = "Document généré automatiquement par le logiciel de gestion Global Maintenance";
  footerCell.font = { italic: true, size: 8, color: { argb: "AAAAAA" } };
  footerCell.alignment = { horizontal: "center" };

  const dateStr = new Date().toISOString().split("T")[0];
  await triggerDownload(workbook, `Paiements_Global_Maintenance_${dateStr}.xlsx`);
}
