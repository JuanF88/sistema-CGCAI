'use client'

import { cn } from '@/lib/utils'

/**
 * Banner de cabecera de página.
 *
 * Mantiene la seña de identidad del diseño —el degradado índigo institucional—
 * pero sin icono: la identidad de la pantalla la llevan el cintillo y el
 * título, y el peso visual, una composición geométrica. Un icono en cada
 * cabecera obliga a inventarse una metáfora por pantalla («¿qué dibujo
 * representa "Plan de Mejoramiento"?») y ninguna acaba siendo evidente.
 *
 * Todo el fondo son cuatro capas, y ninguna trae un color suelto: salen de
 * `--header-from` / `--header-to`, así que el modo oscuro las ajusta solo.
 *
 * · el degradado (`.bg-page-header`)
 * · dos focos radiales (`.banner-luces`), que le dan volumen
 * · anillos concéntricos recortados por la esquina, el motivo que sustituye
 *   al icono
 * · una barra de acento vertical junto al texto, que es lo que ancla el
 *   bloque a la izquierda ahora que no hay pastilla
 *
 * @param {Object}   props
 * @param {string}   props.title
 * @param {string}   [props.eyebrow]        Cintillo sobre el título: el código
 *                                          de formato, el año… lo que sitúa la
 *                                          pantalla sin robarle sitio al
 *                                          subtítulo
 * @param {string}   [props.subtitle]
 * @param {React.ReactNode} [props.actions] Botones a la derecha
 * @param {React.ReactNode} [props.stats]   Chips de métricas a la derecha
 */
export function PageHeader({ title, eyebrow, subtitle, actions, stats, className }) {
  return (
    <header
      className={cn(
        // `isolate` acota el apilado: las capas decorativas nunca se cuelan
        // por encima de un menú o un diálogo abierto sobre el banner.
        'bg-page-header animate-slide-down relative isolate overflow-hidden rounded-3xl',
        'px-6 py-7 sm:px-9 sm:py-8',
        className
      )}
    >
      {/* Capa decorativa. Va entera en un contenedor propio para que el
          `overflow-hidden` del banner recorte los anillos por la esquina: es
          el recorte lo que los convierte en un motivo y no en tres círculos
          sueltos flotando. */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="banner-luces absolute inset-0" />

        <div className="absolute -right-28 -top-44 h-[27rem] w-[27rem] rounded-full border border-white/15" />
        <div className="absolute -right-14 -top-32 h-[20rem] w-[20rem] rounded-full border border-white/25" />
        <div className="absolute right-4 -top-20 h-[12rem] w-[12rem] rounded-full bg-white/[0.07]" />

        {/* Contrapeso abajo, para que la mitad inferior no quede vacía. Solo
            en pantallas anchas: por debajo de lg el banner se apila y esa
            esquina la ocupan los botones. */}
        <div className="absolute -bottom-20 right-64 hidden h-44 w-44 rotate-[18deg] rounded-[3rem] border border-white/10 lg:block" />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-stretch gap-4 sm:gap-5">
          {/* La barra crece con el texto —de ahí `items-stretch`—, así que un
              título con subtítulo largo la alarga sola. */}
          <span
            className="w-1.5 shrink-0 rounded-full bg-gradient-to-b from-white/90 via-white/60 to-white/10"
            aria-hidden="true"
          />

          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-2 inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/90 ring-1 ring-inset ring-white/25">
                {eyebrow}
              </p>
            )}

            <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-[2rem] sm:leading-tight">
              {title}
            </h1>

            {subtitle && (
              <p className="mt-1.5 max-w-2xl text-sm font-medium leading-relaxed text-white/85 sm:text-[0.95rem]">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {(stats || actions) && (
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            {stats}
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}

/**
 * Chip de métrica para la derecha del banner (el `.statChip` original),
 * legible sobre el degradado.
 */
export function HeaderStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/12 px-4 py-2.5 text-center ring-1 ring-inset ring-white/25 backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/75">{label}</p>
      <p className="text-xl font-extrabold tabular-nums text-white">{value}</p>
    </div>
  )
}
