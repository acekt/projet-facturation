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
