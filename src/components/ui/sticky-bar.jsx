'use client'

import { cn } from '@/lib/utils'

/**
 * Barra de acciones pegada al fondo del área visible.
 *
 * En un formulario largo el botón de guardar queda a varias pantallas de
 * distancia; así está siempre a mano, junto al estado de lo que falta.
 *
 * Se queda dentro del flujo (`sticky`, no `fixed`), así que respeta el ancho de
 * su contenedor y no tapa nada al llegar al final.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.info]     A la izquierda: resumen o avisos
 * @param {React.ReactNode} props.children   A la derecha: los botones
 */
export function StickyBar({ info, children, className }) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-3',
        'rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur',
        'supports-[backdrop-filter]:bg-card/80',
        className
      )}
    >
      {info ? <div className="min-w-0 text-sm text-muted-foreground">{info}</div> : <span />}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}
