'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Barra de paginación estándar para las tablas del sistema.
 * Recibe directamente el objeto que devuelve `usePagination`.
 */
export function DataTablePagination({ pagination, etiqueta = 'registros' }) {
  const { page, pageCount, total, from, to, canPrev, canNext, goPrev, goNext } = pagination

  if (total === 0) return null

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> de{' '}
        <span className="font-medium text-foreground">{total}</span> {etiqueta}
      </p>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={goPrev} disabled={!canPrev}>
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          Página {page} de {pageCount}
        </span>
        <Button variant="outline" size="sm" onClick={goNext} disabled={!canNext}>
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
