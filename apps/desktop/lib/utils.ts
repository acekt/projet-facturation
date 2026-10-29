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
  }).format(Math.round(value)).replace(/\u00a0/g, " ") + " FCFA"
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
 * Génère et télécharge un fichier CSV RFC 4180 sécurisé en libérant systématiquement l'URL Blob.
 */
export function downloadSafeCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): void {
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}
