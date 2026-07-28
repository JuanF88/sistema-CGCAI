'use client'

import { useEffect, useMemo, useState } from 'react'

/**
 * Paginación en cliente para listas ya filtradas.
 *
 * Devuelve la página actual, los controles y el trozo de datos a renderizar.
 * Si el filtro reduce la lista y la página actual queda fuera de rango, se
 * vuelve automáticamente a la primera.
 *
 * @param {Array} items
 * @param {number} [pageSize]
 */
export function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(1)

  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    if (page > pageCount) setPage(1)
  }, [page, pageCount])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return {
    page,
    pageCount,
    pageItems,
    total,
    from,
    to,
    canPrev: page > 1,
    canNext: page < pageCount,
    goPrev: () => setPage((p) => Math.max(1, p - 1)),
    goNext: () => setPage((p) => Math.min(pageCount, p + 1)),
    reset: () => setPage(1),
  }
}
