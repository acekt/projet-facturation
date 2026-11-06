import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages || 1)
  const safeCurrentPage = Math.min(Math.max(1, currentPage || 1), safeTotalPages)

  return (
    <div className="flex items-center justify-between px-2 py-4 border-t border-border bg-card/50">
      <div className="flex-1 text-xs text-muted-foreground font-medium uppercase tracking-widest">
        Page {safeCurrentPage} sur {safeTotalPages}
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg cursor-pointer"
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage <= 1}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg cursor-pointer"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center justify-center min-w-[32px] h-8 bg-primary/10 text-primary rounded-lg text-xs font-bold">
          {safeCurrentPage}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg cursor-pointer"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= safeTotalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg cursor-pointer"
          onClick={() => onPageChange(safeTotalPages)}
          disabled={safeCurrentPage >= safeTotalPages}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
