/**
 * ExportService.ts
 * ════════════════════════════════════════════════════════════════
 * Service d'export Excel (.xlsx) premium — charte Global Maintenance
 * Couleurs : Bleu #003399 | Vert #2CA02C
 * ════════════════════════════════════════════════════════════════
 */

import ExcelJS from "exceljs/dist/exceljs.min.js";
import type { Invoice, Quote, Payment } from "@/lib/store";
import {
  EXCEL_COLORS,
  formatExcelDate,
  translateInvoiceStatus,
  translateQuoteStatus,
  applyHeaderRowStyle,
  applyDataRowStyle,
  triggerDownload,
} from "./excel-styles";

// ── Export Factures ────────────────────────────────────────────────────────────

export async function exportInvoicesToExcel(invoices: Invoice[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Global Maintenance";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Factures", {
    pageSetup: { orientation: "landscape", fitToPage: true },
  });

  ws.columns = [
    { key: "number",     width: 24 },
    { key: "client",     width: 32 },
    { key: "date",       width: 14 },
    { key: "dueDate",    width: 16 },
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
  titleCell.value = "GLOBAL MAINTENANCE — Rapport des Factures";
  titleCell.font = { bold: true, size: 16, color: { argb: EXCEL_COLORS.BLUE } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  // Ligne 2 : Date d'export
  ws.mergeCells("A2:G2");
  const dateCell = ws.getCell("A2");
  dateCell.value = `Exporté le ${dateExport}`;
  dateCell.font = { italic: true, size: 10, color: { argb: "666666" } };
  dateCell.alignment = { horizontal: "center" };
  ws.getRow(2).height = 18;

  ws.getRow(3).height = 8;

  // Ligne 4 : Statistiques
  const totalPaye = invoices.filter(i => i.status === "PAID").length;
  const totalImpaye = invoices.filter(i => i.status === "UNPAID" || i.status === "PARTIALLY_PAID").length;
  ws.mergeCells("A4:G4");
  const statsCell = ws.getCell("A4");
  statsCell.value = `Total : ${invoices.length} factures  ·  Payées : ${totalPaye}  ·  Impayées : ${totalImpaye}`;
  statsCell.font = { size: 9, color: { argb: "444444" } };
  statsCell.alignment = { horizontal: "center" };
  ws.getRow(4).height = 16;

  // Ligne 5 : En-têtes
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

  // Données
  invoices.forEach((inv, idx) => {
    const row = ws.addRow([
      inv.number,
      inv.clientName,
      formatExcelDate(inv.date),
      inv.dueDate ? formatExcelDate(inv.dueDate) : "—",
      (inv as any).subject ?? "—",
      inv.total,
      translateInvoiceStatus(inv.status),
    ]);
    applyDataRowStyle(row, idx % 2 === 0);

    row.getCell(6).numFmt = '#,##0 "FCFA"';
    row.getCell(6).alignment = { horizontal: "right", vertical: "middle" };

    const statusCell = row.getCell(7);
    statusCell.alignment = { horizontal: "center", vertical: "middle" };
    if (inv.status === "PAID") {
      statusCell.font = { color: { argb: EXCEL_COLORS.GREEN }, bold: true };
    } else if (inv.status === "UNPAID") {
      statusCell.font = { color: { argb: "CC0000" }, bold: true };
    }
  });

  const footerRowIdx = 6 + invoices.length;
  ws.mergeCells(`A${footerRowIdx}:G${footerRowIdx}`);
  const footerCell = ws.getCell(`A${footerRowIdx}`);
  footerCell.value = "Document généré automatiquement par le logiciel de gestion Global Maintenance";
  footerCell.font = { italic: true, size: 8, color: { argb: "AAAAAA" } };
  footerCell.alignment = { horizontal: "center" };

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
    { key: "validUntil", width: 16 },
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
  titleCell.font = { bold: true, size: 16, color: { argb: EXCEL_COLORS.BLUE } };
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
      formatExcelDate(q.date),
      (q as any).validUntil ? formatExcelDate((q as any).validUntil) : "—",
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
      statusCell.font = { color: { argb: EXCEL_COLORS.GREEN }, bold: true };
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
  titleCell.font = { bold: true, size: 16, color: { argb: EXCEL_COLORS.BLUE } };
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
      formatExcelDate(p.date),
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
