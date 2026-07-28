'use client'

import { cn } from '@/lib/utils'

/**
 * Header de página con el gradiente institucional.
 *
 * Es la seña de identidad del diseño original (`.modernHeader`): gradiente
 * índigo, radio grande y sombra de marca. Vive aquí como primitivo para que
 * todas las pantallas lo compartan en vez de copiarlo.
 *
 * Los colores salen de `--header-from` / `--header-to` (globals.css), así que
 * el modo oscuro lo ajusta solo.
 *
 * @param {Object}   props
 * @param {React.ReactNode} props.icon      Icono de lucide o emoji
 * @param {string}   props.title
 * @param {string}   [props.subtitle]
 * @param {React.ReactNode} [props.actions] Botones a la derecha
 * @param {React.ReactNode} [props.stats]   Chips de métricas a la derecha
 */
export function PageHeader({ icon, title, subtitle, actions, stats, className }) {
  return (
    <header
      className={cn(
        // `bg-page-header` define el gradiente y la sombra en globals.css.
        'bg-page-header animate-slide-down rounded-[20px] px-6 py-7 sm:px-10 sm:py-8',
        className
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          {icon && (
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-3xl text-white backdrop-blur-sm [&_svg]:h-7 [&_svg]:w-7"
              aria-hidden="true"
            >
              {icon}
            </span>
          )}

          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-[2rem] sm:leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 max-w-2xl text-sm font-medium text-white/90 sm:text-base">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {(stats || actions) && (
          <div className="flex flex-wrap items-center gap-3">
            {stats}
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}

/**
 * Chip de métrica para la derecha del header (el `.statChip` original),
 * legible sobre el gradiente.
 */
export function HeaderStat({ label, value }) {
  return (
    <div className="rounded-xl bg-white/15 px-4 py-2 text-center backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">{label}</p>
      <p className="text-xl font-extrabold tabular-nums text-white">{value}</p>
    </div>
  )
}
