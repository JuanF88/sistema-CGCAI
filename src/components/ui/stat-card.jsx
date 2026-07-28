'use client'

import { cn } from '@/lib/utils'

/**
 * Tarjeta de KPI del diseño original: borde izquierdo de color, icono sobre un
 * chip con degradado suave y elevación al pasar el cursor.
 *
 * Los tonos son los del diseño (`.kpiCardBlue`, `.kpiCardPurple`…), aquí con
 * nombre semántico para poder reutilizarlos.
 */
export const STAT_TONES = {
  blue: { bar: 'border-l-blue-500', chip: 'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600' },
  purple: { bar: 'border-l-violet-500', chip: 'bg-gradient-to-br from-violet-100 to-violet-200 text-violet-600' },
  green: { bar: 'border-l-emerald-500', chip: 'bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-600' },
  cyan: { bar: 'border-l-cyan-500', chip: 'bg-gradient-to-br from-cyan-100 to-cyan-200 text-cyan-600' },
  orange: { bar: 'border-l-orange-500', chip: 'bg-gradient-to-br from-orange-100 to-orange-200 text-orange-600' },
  pink: { bar: 'border-l-pink-500', chip: 'bg-gradient-to-br from-pink-100 to-pink-200 text-pink-600' },
  indigo: { bar: 'border-l-indigo-500', chip: 'bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-600' },
  gray: { bar: 'border-l-slate-400', chip: 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600' },
}

export function StatCard({ icon, label, value, tone = 'blue', className }) {
  const t = STAT_TONES[tone] ?? STAT_TONES.blue

  return (
    <article
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border border-l-4 bg-card p-3.5 shadow-sm',
        'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md',
        t.bar,
        className
      )}
    >
      {icon && (
        <span
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl [&_svg]:h-5 [&_svg]:w-5',
            t.chip
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}

      <div className="min-w-0">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-xl font-extrabold leading-none tabular-nums text-foreground">{value}</p>
      </div>
    </article>
  )
}
