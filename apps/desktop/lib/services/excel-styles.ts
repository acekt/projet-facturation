import type { Workbook, Row, Fill } from "exceljs";

export const EXCEL_COLORS = {
  BLUE: "003399",
  WHITE: "FFFFFF",
  LIGHT_BLUE: "E8EDF8",
  GREEN: "2CA02C",
  LIGHT_GREEN: "EAF6EA",
};

export type FillPattern = Fill & { type: "pattern" };

export function solidFill(argb: string): FillPattern {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export function translateInvoiceStatus(status: string): string {
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

export function translateQuoteStatus(status: string): string {
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

export function formatExcelDate(dateStr: string): string {
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

export function applyHeaderRowStyle(row: Row): void {
  row.height = 22;
  row.eachCell((cell) => {
    cell.fill = solidFill(EXCEL_COLORS.BLUE);
    cell.font = { bold: true, color: { argb: EXCEL_COLORS.WHITE }, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: EXCEL_COLORS.WHITE } },
      bottom: { style: "thin", color: { argb: EXCEL_COLORS.WHITE } },
      left: { style: "thin", color: { argb: EXCEL_COLORS.WHITE } },
      right: { style: "thin", color: { argb: EXCEL_COLORS.WHITE } },
    };
  });
}

export function applyDataRowStyle(row: Row, isEven: boolean): void {
  row.height = 18;
  row.eachCell((cell) => {
    cell.fill = solidFill(isEven ? EXCEL_COLORS.LIGHT_BLUE : EXCEL_COLORS.WHITE);
    cell.alignment = { vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "DDDDDD" } },
    };
  });
}

export async function triggerDownload(workbook: Workbook, filename: string): Promise<void> {
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

