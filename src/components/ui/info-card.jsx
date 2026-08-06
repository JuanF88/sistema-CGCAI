'use client'

import { cn } from '@/lib/utils'

/**
 * La tarjeta informativa del sistema, y la única: sustituyó a `StatCard` (icono
 * grande y emoji) y a `MetricCard` (icono de lucide), que ya no existen.
 *
 * Los tonos son los del diseño (`.kpiCardBlue`, `.kpiCardPurple`…), aquí con
 * nombre semántico. Cada uno trae las seis piezas de color de la tarjeta:
 *
 *   `acento`  → la barra vertical de la izquierda
 *   `anillo`  → los dos aros de la esquina
 *   `halo`    → la mancha desenfocada del fondo
 *   `cifra`   → el degradado del número
 *   `suave`   → la píldora del porcentaje
 *   `relleno` → la barra de avance
 *
 * Van escritas enteras y no compuestas (`from-${color}-500`) porque Tailwind
 * busca las clases como texto en el código y una plantilla no la encuentra.
 */
export const STAT_TONES = {
  blue: {
    relleno: 'bg-blue-500',
    acento: 'from-blue-500 to-blue-400',
    anillo: 'border-blue-500/15',
    halo: 'bg-blue-500/25',
    cifra: 'from-blue-600 to-blue-400',
    suave: 'bg-blue-500/10 text-blue-700',
  },
  purple: {
    relleno: 'bg-violet-500',
    acento: 'from-violet-500 to-violet-400',
    anillo: 'border-violet-500/15',
    halo: 'bg-violet-500/25',
    cifra: 'from-violet-600 to-violet-400',
    suave: 'bg-violet-500/10 text-violet-700',
  },
  green: {
    relleno: 'bg-emerald-500',
    acento: 'from-emerald-500 to-emerald-400',
    anillo: 'border-emerald-500/15',
    halo: 'bg-emerald-500/25',
    cifra: 'from-emerald-600 to-emerald-400',
    suave: 'bg-emerald-500/10 text-emerald-700',
  },
  cyan: {
    relleno: 'bg-cyan-500',
    acento: 'from-cyan-500 to-cyan-400',
    anillo: 'border-cyan-500/15',
    halo: 'bg-cyan-500/25',
    cifra: 'from-cyan-600 to-cyan-400',
    suave: 'bg-cyan-500/10 text-cyan-700',
  },
  teal: {
    relleno: 'bg-teal-500',
    acento: 'from-teal-500 to-teal-400',
    anillo: 'border-teal-500/15',
    halo: 'bg-teal-500/25',
    cifra: 'from-teal-600 to-teal-400',
    suave: 'bg-teal-500/10 text-teal-700',
  },
  orange: {
    relleno: 'bg-orange-500',
    acento: 'from-orange-500 to-orange-400',
    anillo: 'border-orange-500/15',
    halo: 'bg-orange-500/25',
    cifra: 'from-orange-600 to-orange-400',
    suave: 'bg-orange-500/10 text-orange-700',
  },
  pink: {
    relleno: 'bg-pink-500',
    acento: 'from-pink-500 to-pink-400',
    anillo: 'border-pink-500/15',
    halo: 'bg-pink-500/25',
    cifra: 'from-pink-600 to-pink-400',
    suave: 'bg-pink-500/10 text-pink-700',
  },
  rose: {
    relleno: 'bg-rose-500',
    acento: 'from-rose-500 to-rose-400',
    anillo: 'border-rose-500/15',
    halo: 'bg-rose-500/25',
    cifra: 'from-rose-600 to-rose-400',
    suave: 'bg-rose-500/10 text-rose-700',
  },
  amber: {
    relleno: 'bg-amber-500',
    acento: 'from-amber-500 to-amber-400',
    anillo: 'border-amber-500/15',
    halo: 'bg-amber-500/25',
    cifra: 'from-amber-600 to-amber-400',
    suave: 'bg-amber-500/10 text-amber-700',
  },
  indigo: {
    relleno: 'bg-indigo-500',
    acento: 'from-indigo-500 to-indigo-400',
    anillo: 'border-indigo-500/15',
    halo: 'bg-indigo-500/25',
    cifra: 'from-indigo-600 to-indigo-400',
    suave: 'bg-indigo-500/10 text-indigo-700',
  },
  gray: {
    relleno: 'bg-slate-400',
    acento: 'from-slate-400 to-slate-300',
    anillo: 'border-slate-400/15',
    halo: 'bg-slate-400/25',
    cifra: 'from-slate-600 to-slate-500',
    suave: 'bg-slate-400/10 text-slate-600',
  },
}

/** El tono pedido, o el azul si no existe. */
const tono = (nombre) => STAT_TONES[nombre] ?? STAT_TONES.blue

/**
 * Tarjeta informativa. Es la que va con el banner de cabecera: sin icono, y
 * con sus mismos recursos —la barra de acento vertical y los anillos
 * recortados por la esquina— en pequeño y en color del tono.
 *
 * El fondo sigue siendo neutro y el color entra por cuatro sitios contados: la
 * barra, los anillos, un halo difuminado en la esquina y la propia cifra. Ocho
 * tarjetas con el fondo teñido compiten entre sí y no destaca ninguna; con el
 * fondo blanco, el color solo señala el dato, que es de lo que va la tarjeta.
 *
 * Contenido en orden de lectura: qué es, cuánto, y cómo va.
 *
 * @param {Object} props
 * @param {string}   props.label
 * @param {number|string} props.value
 * @param {number}   [props.total]    Si viene, se muestra como `valor/total`
 * @param {number}   [props.percent]  Si viene, dibuja la barra de avance
 * @param {string}   [props.hint]     Texto de apoyo; solo si no hay barra
 * @param {string}   [props.tone]     Clave de STAT_TONES
 */
export function InfoCard({ label, value, total, percent, hint, tone: nombreTono = 'blue', className }) {
  const t = tono(nombreTono)
  const hayTotal = total !== undefined && total !== null
  const hayAvance = percent !== undefined && percent !== null

  return (
    <article
      className={cn(
        // `isolate` + `overflow-hidden`: las capas de color se recortan por el
        // borde de la tarjeta y no se salen por encima de la vecina.
        'group relative isolate overflow-hidden rounded-2xl border border-border bg-card',
        'py-4 pl-6 pr-4 shadow-sm',
        'transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
        className
      )}
    >
      {/* Halo: una mancha del tono desenfocada. Es lo que le da color a la
          esquina sin que se vea un borde, y lo que hace que los anillos
          parezcan recortados sobre algo y no dibujados sobre el blanco. */}
      <span
        className={cn(
          'pointer-events-none absolute -right-8 -top-10 -z-10 h-32 w-32 rounded-full blur-2xl',
          'opacity-60 transition-opacity duration-500 group-hover:opacity-100',
          t.halo
        )}
        aria-hidden="true"
      />

      {/* Dos anillos concéntricos, los mismos del banner. Se separan un poco al
          pasar el ratón: el grande crece y el pequeño se queda. */}
      <span
        className={cn(
          'pointer-events-none absolute -right-10 -top-12 -z-10 h-28 w-28 rounded-full border-[6px]',
          'transition-transform duration-500 group-hover:scale-110',
          t.anillo
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          'pointer-events-none absolute -right-3 -top-5 -z-10 h-14 w-14 rounded-full border-2',
          t.anillo
        )}
        aria-hidden="true"
      />

      {/* La barra crece a lo alto de la tarjeta al pasar el ratón: es el mismo
          gesto del acento del banner, que también se estira con el texto. */}
      <span
        className={cn(
          'absolute inset-y-5 left-0 w-1.5 rounded-r-full bg-gradient-to-b',
          'transition-[top,bottom] duration-300 group-hover:inset-y-2',
          t.acento
        )}
        aria-hidden="true"
      />

      {/* Sin `truncate`: en una columna estrecha vale más que baje de línea
          a que se corte a media palabra. */}
      <p className="text-[0.7rem] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
        {label}
      </p>

      {/* La cifra va en degradado del tono y recortada al texto
          (`bg-clip-text`). Es el foco de la tarjeta; el resto es contexto. */}
      <p
        className={cn(
          'mt-2 bg-gradient-to-br bg-clip-text text-[2rem] font-extrabold leading-none tabular-nums text-transparent',
          t.cifra
        )}
      >
        {value}
        {hayTotal && <span className="text-lg font-bold opacity-60">/{total}</span>}
      </p>

      {hayAvance ? (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-[width] duration-500', t.relleno)}
              style={{ width: `${percent}%` }}
            />
          </div>
          {/* Píldora y no texto suelto: es el mismo cintillo del banner, y así
              el porcentaje se lee como una etiqueta y no como otra cifra que
              compite con la grande. */}
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-0.5 text-[0.7rem] font-bold tabular-nums',
              t.suave
            )}
          >
            {percent}%
          </span>
        </div>
      ) : (
        hint && <p className="mt-2.5 text-xs leading-tight text-muted-foreground">{hint}</p>
      )}
    </article>
  )
}
