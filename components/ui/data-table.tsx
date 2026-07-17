"use client"

import * as React from "react"
import { cn, formatCurrency } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

export function DataTable({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn("overflow-hidden border border-border shadow-sm", className)}>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full caption-bottom text-sm">{children}</table>
      </CardContent>
    </Card>
  )
}

export function DataTableHead({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <thead
      className={cn(
        "bg-secondary/50 border-b border-border text-muted-foreground",
        className
      )}
    >
      {children}
    </thead>
  )
}

export function DataTableBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <tbody className={cn("divide-y divide-border", className)}>
      {children}
    </tbody>
  )
}

export function DataTableRow({
  children,
  className,
  ...props
}: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn("hover:bg-muted/50 transition-colors", className)}
      {...props}
    >
      {children}
    </tr>
  )
}

export interface CellProps extends React.ComponentProps<"th"> {
  align?: "left" | "center" | "right"
}

export function DataTableHeaderCell({
  children,
  className,
  align = "left",
  ...props
}: CellProps) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
      {...props}
    >
      {children}
    </th>
  )
}

export function DataTableCell({
  children,
  className,
  align = "left",
  truncate,
  ...props
}: React.ComponentProps<"td"> & { align?: "left" | "center" | "right"; truncate?: boolean }) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-sm text-foreground align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        truncate && "truncate max-w-0",
        className
      )}
      {...props}
    >
      {children}
    </td>
  )
}

export function AmountCell({
  children,
  className,
  amount,
  ...props
}: React.ComponentProps<"td"> & { amount?: number }) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-sm font-mono font-medium text-foreground align-middle text-right",
        className
      )}
      {...props}
    >
      {amount !== undefined && amount !== null ? formatCurrency(Number(amount)) : children}
    </td>
  )
}

export function ActionsCell({
  children,
  className,
  ...props
}: React.ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-sm align-middle text-right",
        className
      )}
      {...props}
    >
      {children}
    </td>
  )
}
