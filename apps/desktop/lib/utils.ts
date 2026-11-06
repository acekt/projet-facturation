import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value)).replace(/[\u00a0\u202f]/g, " ") + " FCFA"
}

export function formatShortCurrency(value: number) {
  return formatCurrency(value)
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  // Si c'est un format ISO strict YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) {
    const [year, month, day] = dateString.trim().split('-');
    return `${day}/${month}/${year}`;
  }
  
  // Fallback pour les timestamps complets (Date)
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

/**
 * Extrait les initiales d'un nom de manière sûre (évite les crashs sur espaces multiples ou nom vide).
 */
export function getInitials(name?: string | null, fallback: string = 'CL'): string {
  if (!name || typeof name !== 'string') return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const initials = parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return initials || fallback;
}

/**
 * Échappe une cellule pour un fichier CSV conforme à la norme RFC 4180.
 * Empêche le décalage des colonnes lors de la présence de virgules, retours à la ligne ou guillemets,
 * et neutralise l'injection de formules tableur (=, @, +CMD, -CMD).
 */
export function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const raw = String(val);
  const needsFormulaEscape = /^[=@]|^[+-][A-Za-z]/.test(raw.trimStart());
  const str = needsFormulaEscape ? `'${raw}` : raw;
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Construit la chaîne CSV complète avec un unique BOM UTF-8 (\uFEFF) et séparateur point-virgule (;).
 */
export function buildSafeCsvContent(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  options?: { delimiter?: ';' | ',' }
): string {
  const delimiter = options?.delimiter ?? ';';
  const csvBody = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(delimiter))
    .join('\r\n');
  return '\uFEFF' + csvBody;
}

/**
 * Génère et télécharge un fichier CSV compatible Excel FR / OHADA (UTF-8 avec BOM + séparateur point-virgule `;`)
 * en libérant systématiquement l'URL Blob.
 */
export function downloadSafeCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  options?: { delimiter?: ';' | ',' }
): void {
  const fullCsv = buildSafeCsvContent(headers, rows, options);
  const encoder = new TextEncoder();
  const utf8Bytes = encoder.encode(fullCsv);
  const blob = new Blob([utf8Bytes], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}
