'use client'

/**
 * Estados de carga del sistema.
 *
 * Tres piezas, y se eligen por lo que se sepa de lo que viene:
 *
 * · `Spinner`   — el aro girando, suelto. Para meterlo dentro de un botón o al
 *                 lado de un texto.
 * · `Cargando`  — el bloque centrado con su aro y su mensaje. Para cuando no se
 *                 sabe qué forma va a tener el contenido, o no merece la pena
 *                 imitarla.
 * · `Skeleton`  — el bloque gris que late. Para cuando **sí** se conoce la
 *                 forma: dibuja el hueco de cada tarjeta y de cada fila, y al
 *                 llegar los datos nada salta de sitio.
 *
 * Cuando se pueda, esqueleto antes que aro: el aro dice «espera» y el esqueleto
 * dice «espera, y esto es lo que va a haber», que se lee como más rápido aunque
 * tarde lo mismo.
 */
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

const TAMANOS = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-9 w-9 border-[3px]',
}

/**
 * Aro girando.
 *
 * Es un borde con solo un lado en color: al girar, ese lado dibuja el arco. Un
 * SVG haría lo mismo con más peso.
 *
 * @param {Object} props
 * @param {'sm'|'md'|'lg'} [props.size]
 */
export function Spinner({ size = 'md', className }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn(
        'inline-block shrink-0 animate-spin rounded-full border-border border-t-primary',
        TAMANOS[size] ?? TAMANOS.md,
        className
      )}
    />
  )
}

/**
 * Bloque de carga centrado, con mensaje.
 *
 * No aparece hasta pasados unos milisegundos. Una respuesta que tarda 80 ms no
 * necesita anunciarse: el aro saldría y desaparecería de golpe, y ese parpadeo
 * se percibe como un fallo, no como una carga.
 *
 * @param {Object} props
 * @param {string} [props.mensaje]
 * @param {number} [props.retraso]  Milisegundos antes de mostrarse
 */
export function Cargando({ mensaje = 'Cargando…', retraso = 150, className }) {
  const [visible, setVisible] = useState(retraso === 0)

  useEffect(() => {
    if (retraso === 0) return
    const t = setTimeout(() => setVisible(true), retraso)
    return () => clearTimeout(t)
  }, [retraso])

  if (!visible) return null

  return (
    <div
      className={cn(
        'flex min-h-[12rem] flex-col items-center justify-center gap-3 py-12 text-center',
        'animate-fade-in',
        className
      )}
    >
      <Spinner size="lg" />
      <p className="text-sm text-muted-foreground">{mensaje}</p>
    </div>
  )
}

/**
 * Hueco que late mientras llega el contenido.
 *
 * El tamaño lo pone quien lo usa (`className`), porque el esqueleto solo sirve
 * si tiene la forma de lo que va a sustituir.
 */
export function Skeleton({ className }) {
  return <span className={cn('block animate-pulse rounded-md bg-muted', className)} aria-hidden="true" />
}

/**
 * Esqueleto de una tarjeta `InfoCard`: etiqueta, cifra y barra.
 *
 * Vive aquí y no en `info-card.jsx` para que la tarjeta no cargue con el peso
 * de su propio estado de carga; lo que importa es que las medidas coincidan.
 */
export function SkeletonInfoCard({ className }) {
  return (
    <article
      className={cn('rounded-2xl border border-border bg-card py-4 pl-6 pr-4 shadow-sm', className)}
      aria-hidden="true"
    >
      <Skeleton className="h-2.5 w-2/3" />
      <Skeleton className="mt-3 h-7 w-1/2" />
      <Skeleton className="mt-3 h-1.5 w-full" />
    </article>
  )
}

/**
 * Rejilla de tarjetas en carga.
 *
 * @param {Object} props
 * @param {number} [props.tarjetas]
 * @param {string} [props.columnas] Clases de rejilla, las mismas de la sección real
 */
export function SkeletonTarjetas({
  tarjetas = 6,
  columnas = 'grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6',
  className,
}) {
  return (
    <section className={cn('grid gap-3', columnas, className)}>
      {Array.from({ length: tarjetas }, (_, i) => (
        <SkeletonInfoCard key={i} />
      ))}
    </section>
  )
}

/**
 * Esqueleto de una tabla: la cabecera y unas cuantas filas.
 *
 * @param {Object} props
 * @param {number} [props.filas]
 * @param {number} [props.columnas]
 */
export function SkeletonTabla({ filas = 5, columnas = 4, className }) {
  return (
    <div
      className={cn('overflow-hidden rounded-xl border border-border bg-card shadow-sm', className)}
      aria-hidden="true"
    >
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <Skeleton className="h-3 w-40" />
      </div>

      <div className="divide-y divide-border">
        {Array.from({ length: filas }, (_, f) => (
          <div key={f} className="flex items-center gap-4 px-4 py-3">
            {Array.from({ length: columnas }, (_, c) => (
              // La primera columna es el nombre y ocupa más; el resto son cifras.
              <Skeleton key={c} className={cn('h-3', c === 0 ? 'flex-[3]' : 'flex-1')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
