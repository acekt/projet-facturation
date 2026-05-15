import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-GA", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value)) + " XAF"
}

export function formatShortCurrency(value: number) {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M XAF"
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(0) + "K XAF"
  }
  return formatCurrency(value)
}
