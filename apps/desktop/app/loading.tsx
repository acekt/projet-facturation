import React from 'react'
import { FileText } from 'lucide-react'

/**
 * Root Loading State — Facturier Desktop
 * ========================================
 * Évite tout écran noir ou vide lors des transitions de routes (ex: /login -> /)
 * ou pendant les compilations / chargements de Server Components.
 */
export default function RootLoading() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#fafafa] z-[100] select-none">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#003399]/20 rounded-full" />
        <div className="absolute w-16 h-16 border-4 border-[#003399] border-t-transparent rounded-full animate-spin" />
        <FileText className="absolute w-6 h-6 text-[#003399] animate-pulse" />
      </div>
      <p className="mt-6 text-sm text-[#71717a] font-medium animate-pulse">
        Chargement de Facturier...
      </p>
    </div>
  )
}
