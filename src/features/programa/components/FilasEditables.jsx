'use client'

/**
 * Lista editable de filas dentro de un formulario.
 *
 * La usan el cronograma y la distribución del programa: mismo patrón —añadir,
 * eliminar, numerar— con campos distintos, que los define quien la usa.
 */
import { Plus, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * @param {Object} props
 * @param {Array} props.filas
 * @param {(filas: Array) => void} props.onChange
 * @param {Object} props.filaVacia            Plantilla de una fila nueva
 * @param {string} props.etiqueta             Singular, para los textos
 * @param {(fila, i, set) => React.ReactNode} props.children  Campos de la fila
 * @param {string} [props.vacio]              Texto cuando no hay filas
 */
export function FilasEditables({ filas, onChange, filaVacia, etiqueta, children, vacio }) {
  /**
   * `set('campo', valor)` o `set({ campo: valor, otro: valor })`.
   *
   * La forma de objeto existe porque elegir de un desplegable rellena varios
   * campos de golpe: encadenar llamadas de un solo campo leería `filas` del
   * cierre anterior y solo sobreviviría el último cambio.
   */
  const actualizar = (indice, campoOParche, valor) => {
    const parche =
      typeof campoOParche === 'string' ? { [campoOParche]: valor } : campoOParche

    onChange(filas.map((f, i) => (i === indice ? { ...f, ...parche } : f)))
  }

  const eliminar = (indice) => onChange(filas.filter((_, i) => i !== indice))

  return (
    <div className="space-y-3">
      {filas.length === 0 && (
        <p className="rounded-xl border border-dashed border-border bg-background/60 px-4 py-6 text-center text-xs text-muted-foreground">
          {vacio || `Todavía no hay ${etiqueta.toLowerCase()}s.`}
        </p>
      )}

      {filas.map((fila, i) => (
        <article
          key={i}
          className={cn(
            'relative space-y-3 rounded-xl border border-border bg-background p-3',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:shadow-none'
          )}
        >
          <header className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {etiqueta} #{i + 1}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => eliminar(i)}
              title={`Eliminar ${etiqueta.toLowerCase()} #${i + 1}`}
              className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">
                Eliminar {etiqueta.toLowerCase()} #{i + 1}
              </span>
            </Button>
          </header>

          {children(fila, i, (campoOParche, valor) => actualizar(i, campoOParche, valor))}
        </article>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...filas, { ...filaVacia }])}
        className="w-full"
      >
        <Plus />
        Añadir {etiqueta.toLowerCase()}
      </Button>
    </div>
  )
}
