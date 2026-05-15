"use client"

import * as React from "react"
import { ThemeProvider } from "next-themes"

import { Toaster } from "sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
    >
      {children}
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  )
}
